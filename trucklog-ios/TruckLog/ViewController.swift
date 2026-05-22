import UIKit
import WebKit
import Network

class ViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {

    private var webView: WKWebView!
    private var progressView: UIProgressView!
    private var progressObservation: NSKeyValueObservation?
    private var pathMonitor: NWPathMonitor?
    private var isShowingOffline = false

    private let appURL = URL(string: "https://trucklogapp.com")!

    // Safari user agent so Google/Firebase OAuth isn't blocked by disallowed_useragent
    private let safariAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.allowsAirPlayForMediaPlayback = true
        config.allowsPictureInPictureMediaPlayback = true

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.customUserAgent = safariAgent
        webView.allowsBackForwardNavigationGestures = true   // Tweak 4: swipe back
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        view = webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupProgressBar()    // Tweak 2
        setupRefreshControl() // Tweak 1
        startNetworkMonitor() // Tweak 3
        loadApp()
    }

    private func loadApp() {
        webView.load(URLRequest(url: appURL))
    }

    // MARK: - Tweak 1: Pull-to-refresh

    private func setupRefreshControl() {
        let refresh = UIRefreshControl()
        refresh.tintColor = UIColor(red: 0.92, green: 0.35, blue: 0.05, alpha: 1) // #ea580c orange
        refresh.addTarget(self, action: #selector(handleRefresh), for: .valueChanged)
        webView.scrollView.addSubview(refresh)
    }

    @objc private func handleRefresh(_ sender: UIRefreshControl) {
        loadApp()
        // End refreshing after a short delay so the spinner feels responsive
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            sender.endRefreshing()
        }
    }

    // MARK: - Tweak 2: Native loading progress bar

    private func setupProgressBar() {
        progressView = UIProgressView(progressViewStyle: .bar)
        progressView.translatesAutoresizingMaskIntoConstraints = false
        progressView.progressTintColor = UIColor(red: 0.92, green: 0.35, blue: 0.05, alpha: 1)
        progressView.trackTintColor = .clear
        view.addSubview(progressView)

        NSLayoutConstraint.activate([
            progressView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            progressView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            progressView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            progressView.heightAnchor.constraint(equalToConstant: 3),
        ])

        progressObservation = webView.observe(\.estimatedProgress, options: .new) { [weak self] _, change in
            guard let self, let progress = change.newValue else { return }
            DispatchQueue.main.async {
                let p = Float(progress)
                self.progressView.setProgress(p, animated: true)
                self.progressView.isHidden = p >= 1.0
                if p < 1.0 { self.progressView.isHidden = false }
            }
        }
    }

    // MARK: - Tweak 3: Auto-reconnect via NWPathMonitor

    private func startNetworkMonitor() {
        pathMonitor = NWPathMonitor()
        pathMonitor?.pathUpdateHandler = { [weak self] path in
            guard let self else { return }
            if path.status == .satisfied && self.isShowingOffline {
                DispatchQueue.main.async {
                    self.isShowingOffline = false
                    self.loadApp()
                }
            }
        }
        pathMonitor?.start(queue: DispatchQueue(label: "NetworkMonitor"))
    }

    // MARK: - Open target="_blank" links in the same webview

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

    // MARK: - Offline / error fallback + Tweak 5: haptic feedback

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        isShowingOffline = true

        // Tweak 5: haptic error bump
        UINotificationFeedbackGenerator().notificationOccurred(.error)

        let html = """
        <html>
        <head><meta name='viewport' content='width=device-width,initial-scale=1'></head>
        <body style='background:#0a0a0a;color:white;font-family:-apple-system,sans-serif;
                     display:flex;align-items:center;justify-content:center;
                     height:100vh;margin:0;text-align:center'>
          <div>
            <div style='font-size:4rem;margin-bottom:16px'>🚛</div>
            <h2 style='margin-bottom:8px'>No Connection</h2>
            <p style='color:rgba(255,255,255,0.6);margin-bottom:24px'>Check your internet and try again</p>
            <button onclick='location.reload()'
              style='background:#ea580c;color:white;border:none;padding:14px 28px;
                     border-radius:12px;font-size:1rem;font-weight:600;cursor:pointer'>
              Retry
            </button>
          </div>
        </body>
        </html>
        """
        webView.loadHTMLString(html, baseURL: nil)
    }

    // MARK: - Status bar style

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    deinit {
        progressObservation?.invalidate()
        pathMonitor?.cancel()
    }
}
