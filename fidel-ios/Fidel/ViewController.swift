import UIKit
import WebKit

class ViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {

    private var webView: WKWebView!
    private let appURL = URL(string: "https://tigrinya-school.web.app")!

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.allowsAirPlayForMediaPlayback = true
        config.allowsPictureInPictureMediaPlayback = true

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = false
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        view = webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        loadApp()
    }

    private func loadApp() {
        webView.load(URLRequest(url: appURL))
    }

    // Open target="_blank" links in the same webview
    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if navigationAction.targetFrame == nil {
            webView.load(navigationAction.request)
        }
        return nil
    }

    // Offline / error fallback
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let html = """
        <html>
        <head><meta name='viewport' content='width=device-width,initial-scale=1'></head>
        <body style='background:#1a1a2e;color:white;font-family:-apple-system,sans-serif;
                     display:flex;align-items:center;justify-content:center;
                     height:100vh;margin:0;text-align:center'>
          <div>
            <div style='font-size:4rem;margin-bottom:16px'>📡</div>
            <h2 style='margin-bottom:8px'>No Connection</h2>
            <p style='color:rgba(255,255,255,0.6);margin-bottom:24px'>Check your internet and try again</p>
            <button onclick='location.reload()'
              style='background:#3B82F6;color:white;border:none;padding:14px 28px;
                     border-radius:12px;font-size:1rem;font-weight:600;cursor:pointer'>
              Retry
            </button>
          </div>
        </body>
        </html>
        """
        webView.loadHTMLString(html, baseURL: nil)
    }

    // Status bar style
    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
}
