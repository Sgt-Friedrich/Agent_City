#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::api::dialog::blocking::FileDialogBuilder;
use tauri::api::shell;
use tauri::{Manager, RunEvent, WindowBuilder, WindowUrl};

#[derive(Clone)]
struct AppConfig {
    frontend_bundle_dir: PathBuf,
    backend_dir: PathBuf,
    docs_dir: PathBuf,
    backend_port: u16,
    frontend_url: String,
    backend_url: String,
    dev_mode: bool,
    smoke_mode: bool,
}

impl AppConfig {
    fn from_env() -> Self {
        let root_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .and_then(Path::parent)
            .map(Path::to_path_buf)
            .unwrap_or_else(|| PathBuf::from("../.."));
        let frontend_dir = root_dir.join("frontend");
        let frontend_bundle_dir = frontend_dir.join("out");
        let backend_dir = root_dir.join("backend");
        let docs_dir = root_dir.join("docs");

        let backend_port = env::var("AGENT_CITY_BACKEND_PORT")
            .ok()
            .and_then(|v| v.parse::<u16>().ok())
            .unwrap_or(8000);

        let frontend_url =
            env::var("AGENT_CITY_FRONTEND_URL").unwrap_or_else(|_| "app://agent_city".to_string());
        let backend_url = env::var("AGENT_CITY_BACKEND_URL")
            .unwrap_or_else(|_| format!("http://127.0.0.1:{backend_port}"));

        let dev_mode = env::var("NODE_ENV")
            .map(|value| value != "production")
            .unwrap_or(true);
        let smoke_mode = env::var("AGENT_CITY_DESKTOP_SMOKE")
            .map(|value| value == "1")
            .unwrap_or(false);

        Self {
            frontend_bundle_dir,
            backend_dir,
            docs_dir,
            backend_port,
            frontend_url,
            backend_url,
            dev_mode,
            smoke_mode,
        }
    }

    fn backend_health_url(&self) -> String {
        format!("{}/healthz", self.backend_url.trim_end_matches('/'))
    }

}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopServiceStatus {
    url: String,
    ready: bool,
    managed: bool,
    pid: Option<u32>,
    message: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopAppStatus {
    shell_mode: String,
    backend: DesktopServiceStatus,
    frontend: DesktopServiceStatus,
    last_error: Option<String>,
    updated_at: String,
}

#[derive(Serialize)]
struct OpenPathResult {
    ok: bool,
    message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenReportsDirectoryResult {
    ok: bool,
    path: Option<String>,
    message: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveTextReportPayload {
    default_file_name: Option<String>,
    content: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SaveTextReportResult {
    ok: bool,
    canceled: Option<bool>,
    path: Option<String>,
}

struct DesktopRuntime {
    config: AppConfig,
    status: DesktopAppStatus,
    backend_child: Option<Child>,
    frontend_child: Option<Child>,
}

impl DesktopRuntime {
    fn new(config: AppConfig) -> Self {
        Self {
            status: DesktopAppStatus {
                shell_mode: "desktop".to_string(),
                backend: DesktopServiceStatus {
                    url: config.backend_url.clone(),
                    ready: false,
                    managed: false,
                    pid: None,
                    message: "not_checked".to_string(),
                },
                frontend: DesktopServiceStatus {
                    url: config.frontend_url.clone(),
                    ready: false,
                    managed: false,
                    pid: None,
                    message: "not_checked".to_string(),
                },
                last_error: None,
                updated_at: now_iso(),
            },
            config,
            backend_child: None,
            frontend_child: None,
        }
    }

    fn ensure_services(&mut self) {
        let no_spawn = env::var("AGENT_CITY_DESKTOP_NO_SPAWN")
            .map(|value| value == "1")
            .unwrap_or(false);

        if let Err(error) = self.ensure_backend(no_spawn) {
            self.status.last_error = Some(error);
        }

        if let Err(error) = self.ensure_frontend(no_spawn) {
            self.status.last_error = Some(error);
        }

        self.status.updated_at = now_iso();
    }

    fn ensure_backend(&mut self, no_spawn: bool) -> Result<(), String> {
        let health_url = self.config.backend_health_url();

        if !child_alive(self.backend_child.as_mut()) {
            self.backend_child = None;
        }

        if health_check(&health_url) {
            self.status.backend.ready = true;
            if let Some(child) = self.backend_child.as_ref() {
                self.status.backend.managed = true;
                self.status.backend.pid = Some(child.id());
                self.status.backend.message = "ready".to_string();
            } else {
                self.status.backend.managed = false;
                self.status.backend.pid = None;
                self.status.backend.message = "external_service_detected".to_string();
            }
            return Ok(());
        }

        if no_spawn {
            self.status.backend.ready = false;
            self.status.backend.managed = false;
            self.status.backend.pid = None;
            self.status.backend.message = "not_available_and_spawn_disabled".to_string();
            return Ok(());
        }

        if self.backend_child.is_none() {
            let child = self.spawn_backend_process()?;
            self.status.backend.managed = true;
            self.status.backend.pid = Some(child.id());
            self.status.backend.message = "starting".to_string();
            self.backend_child = Some(child);
        }

        if wait_for_healthy(&health_url, Duration::from_secs(28)) {
            self.status.backend.ready = true;
            self.status.backend.managed = self.backend_child.is_some();
            self.status.backend.pid = self.backend_child.as_ref().map(Child::id);
            self.status.backend.message = "ready".to_string();
            return Ok(());
        }

        self.status.backend.ready = false;
        self.status.backend.message = "starting_timeout".to_string();
        Err(format!(
            "backend service did not become healthy: {health_url}"
        ))
    }

    fn ensure_frontend(&mut self, _no_spawn: bool) -> Result<(), String> {
        if let Some(mut child) = self.frontend_child.take() {
            terminate_child(&mut child);
        }

        let entry_file = self.config.frontend_bundle_dir.join("index.html");
        if entry_file.exists() {
            self.status.frontend.ready = true;
            self.status.frontend.managed = false;
            self.status.frontend.pid = None;
            self.status.frontend.message = "static_bundle_ready".to_string();
            return Ok(());
        }

        self.status.frontend.ready = false;
        self.status.frontend.managed = false;
        self.status.frontend.pid = None;
        self.status.frontend.message = "static_bundle_missing".to_string();
        Err(format!(
            "frontend static bundle missing: {} (run `npm --prefix frontend run build`)",
            entry_file.display()
        ))
    }

    fn spawn_backend_process(&self) -> Result<Child, String> {
        let launcher = resolve_python_launcher().ok_or_else(|| {
            "Python launcher not found. Set AGENT_CITY_PYTHON to a valid executable.".to_string()
        })?;

        let mut command = Command::new(&launcher.command);
        for arg in launcher.prefix_args {
            command.arg(arg);
        }

        command
            .arg("-m")
            .arg("uvicorn")
            .arg("app.main:app")
            .arg("--host")
            .arg("127.0.0.1")
            .arg("--port")
            .arg(self.config.backend_port.to_string())
            .current_dir(&self.config.backend_dir)
            .stdout(Stdio::null())
            .stderr(Stdio::null());

        let mut python_paths = vec![self.config.backend_dir.display().to_string()];
        if let Ok(current) = env::var("PYTHONPATH") {
            if !current.trim().is_empty() {
                python_paths.push(current);
            }
        }
        command.env("PYTHONPATH", python_paths.join(path_separator()));

        command
            .spawn()
            .map_err(|error| format!("failed to spawn backend process: {error}"))
    }

    fn stop_services(&mut self) {
        if let Some(mut child) = self.frontend_child.take() {
            terminate_child(&mut child);
        }
        if let Some(mut child) = self.backend_child.take() {
            terminate_child(&mut child);
        }
    }
}

#[derive(Clone)]
struct PythonLauncher {
    command: String,
    prefix_args: Vec<String>,
}

fn resolve_python_launcher() -> Option<PythonLauncher> {
    let mut candidates: Vec<PythonLauncher> = Vec::new();

    if let Ok(value) = env::var("AGENT_CITY_PYTHON") {
        if !value.trim().is_empty() {
            candidates.push(PythonLauncher {
                command: value,
                prefix_args: vec![],
            });
        }
    }

    if cfg!(windows) {
        candidates.push(PythonLauncher {
            command: "py".to_string(),
            prefix_args: vec!["-3".to_string()],
        });
        candidates.push(PythonLauncher {
            command: "python".to_string(),
            prefix_args: vec![],
        });
    } else {
        candidates.push(PythonLauncher {
            command: "python3".to_string(),
            prefix_args: vec![],
        });
        candidates.push(PythonLauncher {
            command: "python".to_string(),
            prefix_args: vec![],
        });
    }

    for candidate in candidates {
        let mut command = Command::new(&candidate.command);
        for arg in &candidate.prefix_args {
            command.arg(arg);
        }
        let status = command
            .arg("--version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();

        if status.map(|item| item.success()).unwrap_or(false) {
            return Some(candidate);
        }
    }

    None
}

fn path_separator() -> &'static str {
    if cfg!(windows) {
        ";"
    } else {
        ":"
    }
}

fn child_alive(child: Option<&mut Child>) -> bool {
    if let Some(child) = child {
        match child.try_wait() {
            Ok(Some(_)) => false,
            Ok(None) => true,
            Err(_) => false,
        }
    } else {
        false
    }
}

fn terminate_child(child: &mut Child) {
    #[cfg(windows)]
    {
        let _ = Command::new("taskkill")
            .arg("/pid")
            .arg(child.id().to_string())
            .arg("/f")
            .arg("/t")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }

    #[cfg(not(windows))]
    {
        let _ = child.kill();
    }

    let _ = child.wait();
}

fn health_check(url: &str) -> bool {
    let agent = ureq::AgentBuilder::new()
        .timeout(Duration::from_millis(1200))
        .build();
    agent.get(url).call().is_ok()
}

fn wait_for_healthy(url: &str, timeout: Duration) -> bool {
    let started = Instant::now();
    while started.elapsed() < timeout {
        if health_check(url) {
            return true;
        }
        thread::sleep(Duration::from_millis(650));
    }
    false
}

fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

fn create_main_window(app: &tauri::AppHandle, open_devtools: bool) -> Result<(), String> {
    let window = WindowBuilder::new(app, "main", WindowUrl::App("index.html".into()))
        .title("Agent_City Workbench")
        .inner_size(1760.0, 1024.0)
        .min_inner_size(1320.0, 820.0)
        .visible(true)
        .build()
        .map_err(|error| format!("failed to build main window: {error}"))?;

    if open_devtools {
        window.open_devtools();
    }

    Ok(())
}

#[tauri::command]
fn get_app_status(state: tauri::State<'_, Mutex<DesktopRuntime>>) -> Result<DesktopAppStatus, String> {
    let mut runtime = state
        .lock()
        .map_err(|_| "desktop runtime lock poisoned".to_string())?;
    runtime.ensure_services();
    Ok(runtime.status.clone())
}

#[tauri::command]
fn open_path(app: tauri::AppHandle, target_path: String) -> Result<OpenPathResult, String> {
    if target_path.trim().is_empty() {
        return Ok(OpenPathResult {
            ok: false,
            message: "invalid target path".to_string(),
        });
    }

    shell::open(&app.shell_scope(), target_path, None)
        .map(|_| OpenPathResult {
            ok: true,
            message: "opened".to_string(),
        })
        .map_err(|error| format!("failed to open path: {error}"))
}

#[tauri::command]
fn open_reports_directory(
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<DesktopRuntime>>,
) -> Result<OpenReportsDirectoryResult, String> {
    let docs_dir = {
        let runtime = state
            .lock()
            .map_err(|_| "desktop runtime lock poisoned".to_string())?;
        runtime.config.docs_dir.clone()
    };

    let docs_text = docs_dir.display().to_string();
    shell::open(&app.shell_scope(), docs_text.clone(), None)
        .map(|_| OpenReportsDirectoryResult {
            ok: true,
            path: Some(docs_text),
            message: Some("opened".to_string()),
        })
        .map_err(|error| format!("failed to open docs directory: {error}"))
}

#[tauri::command]
fn save_text_report(
    payload: SaveTextReportPayload,
    state: tauri::State<'_, Mutex<DesktopRuntime>>,
) -> Result<SaveTextReportResult, String> {
    let docs_dir = {
        let runtime = state
            .lock()
            .map_err(|_| "desktop runtime lock poisoned".to_string())?;
        runtime.config.docs_dir.clone()
    };

    let default_file_name = payload
        .default_file_name
        .unwrap_or_else(|| "agent_city_report.md".to_string());

    let selected = FileDialogBuilder::new()
        .set_title("Export Agent_City Report")
        .set_directory(docs_dir)
        .set_file_name(&default_file_name)
        .add_filter("Markdown", &["md"])
        .add_filter("Text", &["txt"])
        .save_file();

    if let Some(path) = selected {
        fs::write(&path, payload.content)
            .map_err(|error| format!("failed to save report file: {error}"))?;

        return Ok(SaveTextReportResult {
            ok: true,
            canceled: Some(false),
            path: Some(path.display().to_string()),
        });
    }

    Ok(SaveTextReportResult {
        ok: false,
        canceled: Some(true),
        path: None,
    })
}

fn main() {
    let config = AppConfig::from_env();
    let runtime = Mutex::new(DesktopRuntime::new(config));

    let app = tauri::Builder::default()
        .manage(runtime)
        .invoke_handler(tauri::generate_handler![
            get_app_status,
            open_path,
            open_reports_directory,
            save_text_report
        ])
        .setup(|app| {
            let (dev_mode, smoke_mode, status) = {
                let state = app.state::<Mutex<DesktopRuntime>>();
                let mut runtime = state
                    .lock()
                    .map_err(|_| "desktop runtime lock poisoned".to_string())?;

                runtime.ensure_services();
                (
                    runtime.config.dev_mode,
                    runtime.config.smoke_mode,
                    runtime.status.clone(),
                )
            };

            if smoke_mode {
                let snapshot = serde_json::to_string(&status).unwrap_or_else(|_| "{}".to_string());
                println!("[desktop-smoke] {snapshot}");
                std::process::exit(if status.backend.ready && status.frontend.ready {
                    0
                } else {
                    1
                });
            }

            create_main_window(&app.app_handle(), dev_mode)?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build Agent_City desktop app");

    app.run(|app_handle, event| {
        if matches!(event, RunEvent::ExitRequested { .. } | RunEvent::Exit) {
            if let Ok(mut runtime) = app_handle.state::<Mutex<DesktopRuntime>>().lock() {
                runtime.stop_services();
            }
        }
    });
}
