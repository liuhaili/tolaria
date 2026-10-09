use std::path::{Component, Path};
use tauri::http::{header, Method, Request, Response, StatusCode};
use tauri::Manager;

const CSP: &str = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'none'";

fn safe_path(raw: &str) -> Option<&str> {
    let path = raw.trim_start_matches('/');
    if path.is_empty() || path.contains(['%', '\\', ':']) {
        return None;
    }
    Path::new(path)
        .components()
        .all(|part| matches!(part, Component::Normal(_)))
        .then_some(path)
}

fn content_type(path: &str) -> &'static str {
    match Path::new(path).extension().and_then(|ext| ext.to_str()) {
        Some("html") => "text/html; charset=utf-8",
        Some("js") => "text/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("gif") => "image/gif",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("woff2") => "font/woff2",
        Some("woff") => "font/woff",
        Some("xml") => "application/xml",
        Some("json") => "application/json",
        _ => "text/plain; charset=utf-8",
    }
}

pub(crate) fn handle_request(
    context: tauri::UriSchemeContext<'_, tauri::Wry>,
    request: Request<Vec<u8>>,
) -> Response<Vec<u8>> {
    let path = safe_path(request.uri().path());
    let root = if cfg!(debug_assertions) {
        Some(Path::new(env!("CARGO_MANIFEST_DIR")).join("../public/drawio"))
    } else {
        context.app_handle().path().resource_dir().ok().map(|dir| dir.join("drawio"))
    };
    let bytes = root.zip(path).filter(|_| request.method() == Method::GET)
        .and_then(|(root, path)| {
            let root = root.canonicalize().ok()?;
            let file = root.join(path).canonicalize().ok()?;
            file.starts_with(&root).then_some(file).and_then(|file| std::fs::read(file).ok())
        });
    let status = if bytes.is_some() { StatusCode::OK } else { StatusCode::NOT_FOUND };
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, content_type(path.unwrap_or("")))
        .header(header::CONTENT_SECURITY_POLICY, CSP)
        .header(header::X_CONTENT_TYPE_OPTIONS, "nosniff")
        .header(header::REFERRER_POLICY, "no-referrer")
        .body(bytes.unwrap_or_default())
        .expect("static draw.io response headers are valid")
}

#[cfg(test)]
mod tests {
    use super::safe_path;
    #[test]
    fn assets_cannot_escape_the_vendor_directory() {
        assert_eq!(safe_path("/js/app.min.js"), Some("js/app.min.js"));
        for path in ["/../secret", "/%2e%2e/secret", "/C:/secret", "/js\\secret", ""] {
            assert_eq!(safe_path(path), None);
        }
    }
}
