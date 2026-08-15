import UIKit
import WebKit
import Network

class ViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {

    private var webView: WKWebView!
    private var progressView: UIProgressView!
    private var progressObservation: NSKeyValueObservation?
    private var pathMonitor: NWPathMonitor?
    private var isShowingOffline = false
    private var practiceNav: UINavigationController?

    private let appURL = URL(string: "https://eri-tigrinya-school.web.app")!

    // Safari user agent — prevents disallowed_useragent blocks on auth flows
    private let safariAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"

    // Fidel brand blue: #3B82F6
    private let brandColor = UIColor(red: 0.23, green: 0.51, blue: 0.96, alpha: 1)

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
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        view = webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupProgressBar()
        setupRefreshControl()
        startNetworkMonitor()
        loadApp()
    }

    private func loadApp() {
        webView.load(URLRequest(url: appURL))
    }

    // MARK: - Pull-to-refresh

    private func setupRefreshControl() {
        let refresh = UIRefreshControl()
        refresh.tintColor = brandColor
        refresh.addTarget(self, action: #selector(handleRefresh), for: .valueChanged)
        webView.scrollView.addSubview(refresh)
    }

    @objc private func handleRefresh(_ sender: UIRefreshControl) {
        loadApp()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            sender.endRefreshing()
        }
    }

    // MARK: - Native loading progress bar

    private func setupProgressBar() {
        progressView = UIProgressView(progressViewStyle: .bar)
        progressView.translatesAutoresizingMaskIntoConstraints = false
        progressView.progressTintColor = brandColor
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

    // MARK: - Auto-reconnect via NWPathMonitor

    private func startNetworkMonitor() {
        pathMonitor = NWPathMonitor()
        pathMonitor?.pathUpdateHandler = { [weak self] path in
            guard let self else { return }
            if path.status == .satisfied && self.isShowingOffline {
                DispatchQueue.main.async {
                    /* Must dismiss the practice screen too, or reconnecting
                       reloads the site behind a modal the child can't see past. */
                    self.dismissOfflinePractice()
                }
            }
        }
        pathMonitor?.start(queue: DispatchQueue(label: "NetworkMonitor"))
    }

    // MARK: - Open target="_blank" links inside the webview

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

    // MARK: - Offline fallback with haptic

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        isShowingOffline = true
        UINotificationFeedbackGenerator().notificationOccurred(.error)

        /* The whole app is this web view, so losing the network used to leave a
           child with a dead "No Connection" screen. The bundled flashcard deck
           needs no network, so offer that instead of nothing. */
        showOfflinePractice()
    }

    // MARK: - Offline practice

    private func showOfflinePractice() {
        guard practiceNav == nil, presentedViewController == nil else { return }

        let practice = PracticeViewController()
        practice.navigationItem.leftBarButtonItem = UIBarButtonItem(
            title: "Retry", style: .plain, target: self, action: #selector(retryConnection)
        )

        let nav = UINavigationController(rootViewController: practice)
        nav.modalPresentationStyle = .fullScreen
        nav.navigationBar.tintColor = brandColor
        nav.navigationBar.titleTextAttributes = [.foregroundColor: UIColor.white]
        nav.navigationBar.barTintColor = UIColor(red: 0.07, green: 0.07, blue: 0.12, alpha: 1)
        nav.navigationBar.isTranslucent = false

        practiceNav = nav
        present(nav, animated: true)
    }

    @objc private func retryConnection() {
        dismissOfflinePractice()
    }

    private func dismissOfflinePractice() {
        isShowingOffline = false
        guard let nav = practiceNav else { loadApp(); return }
        practiceNav = nil
        nav.dismiss(animated: true) { [weak self] in self?.loadApp() }
    }

    // MARK: - Status bar style

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    deinit {
        progressObservation?.invalidate()
        pathMonitor?.cancel()
    }
}
