import UIKit
import WebKit
import Network
import AuthenticationServices
import CryptoKit

class ViewController: UIViewController,
                      WKNavigationDelegate,
                      WKUIDelegate,
                      WKScriptMessageHandler,
                      ASAuthorizationControllerDelegate,
                      ASAuthorizationControllerPresentationContextProviding {

    private var webView: WKWebView!
    private var progressView: UIProgressView!
    private var progressObservation: NSKeyValueObservation?
    private var pathMonitor: NWPathMonitor?
    private var isShowingOffline = false
    private var currentNonce: String?

    private let appURL = URL(string: "https://trucklogapp.com")!

    // Safari user agent so Google/Firebase OAuth isn't blocked by disallowed_useragent
    private let safariAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.allowsAirPlayForMediaPlayback = true
        config.allowsPictureInPictureMediaPlayback = true

        // Bridge: web page calls window.webkit.messageHandlers.appleSignIn.postMessage({})
        // when the injected Apple button is tapped.
        config.userContentController.add(self, name: "appleSignIn")

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
        refresh.tintColor = UIColor(red: 0.92, green: 0.35, blue: 0.05, alpha: 1)
        refresh.addTarget(self, action: #selector(handleRefresh), for: .valueChanged)
        webView.scrollView.addSubview(refresh)
    }

    @objc private func handleRefresh(_ sender: UIRefreshControl) {
        webView.url != nil ? webView.reload() : loadApp()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { sender.endRefreshing() }
    }

    // MARK: - Loading progress bar

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
        if navigationAction.targetFrame == nil { webView.load(navigationAction.request) }
        return nil
    }

    // MARK: - Offline / error fallback

    func webView(_ wv: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        self.webView(wv, didFailProvisionalNavigation: navigation, withError: error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        isShowingOffline = true
        UINotificationFeedbackGenerator().notificationOccurred(.error)
        let html = """
        <html><head><meta name='viewport' content='width=device-width,initial-scale=1'></head>
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
        </body></html>
        """
        webView.loadHTMLString(html, baseURL: nil)
    }

    // MARK: - Inject Sign in with Apple button after each page load

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard let url = webView.url?.absoluteString,
              url.contains("trucklogapp.com") else { return }
        webView.evaluateJavaScript(appleButtonInjectionScript)
    }

    // Injects a native-looking "Sign in with Apple" button immediately above the
    // "Continue with Google" button. Idempotent: safe to call on every page load.
    // Uses a MutationObserver to handle React/SPA route changes that re-render the form.
    private var appleButtonInjectionScript: String { """
        (function() {
          function inject() {
            if (document.getElementById('_ios_apple_btn')) return;

            // Locate the Google button by any common pattern
            var googleBtn = document.querySelector('[data-provider="google"]')
              || Array.from(document.querySelectorAll('button')).find(function(b){
                   return b.textContent.toLowerCase().includes('google');
                 });
            if (!googleBtn) return;

            var btn = document.createElement('button');
            btn.id = '_ios_apple_btn';
            btn.type = 'button';
            btn.innerHTML =
              '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="22" viewBox="0 0 814 1000" fill="currentColor" style="flex-shrink:0">'
            + '<path d="M788 341c-6 5-108 62-108 191 0 148 130 201 134 202-1 3-21 72-69 142-43 62-87 123-156 123-68 0-85-40-164-40-76 0-103 41-165 41-63 0-105-48-148-112C115 780 68 688 68 600c0-151 98-231 191-231 98 0 160 67 199 67 40 0 103-70 202-70h30z"/>'
            + '<path d="M549 0c40 26 68 76 68 125v7c-44 4-86 30-112 67-23 34-35 78-35 121l1 6h2c41 0 82-23 108-67 25-41 32-84 32-106v-7C611 146 582 29 549 0z"/>'
            + '</svg>'
            + '<span>Sign in with Apple</span>';
            btn.style.cssText = [
              'display:flex', 'align-items:center', 'justify-content:center', 'gap:10px',
              'width:100%', 'padding:14px 20px',
              'background:#000', 'color:#fff',
              'border:1px solid rgba(255,255,255,0.15)',
              'border-radius:14px', 'font-size:16px', 'font-weight:600',
              'cursor:pointer', 'margin-bottom:10px',
              'font-family:-apple-system,BlinkMacSystemFont,sans-serif',
              'box-sizing:border-box', '-webkit-tap-highlight-color:rgba(0,0,0,0.3)'
            ].join(';');

            btn.addEventListener('click', function(e) {
              e.preventDefault(); e.stopPropagation();
              window.webkit.messageHandlers.appleSignIn.postMessage({});
            });

            googleBtn.parentNode.insertBefore(btn, googleBtn);
          }

          inject();
          // Retry for slow-rendering SPAs
          setTimeout(inject, 600);
          setTimeout(inject, 2000);

          // Watch for DOM mutations (React re-renders login form on tab switch)
          if (!window._appleObserver) {
            window._appleObserver = new MutationObserver(inject);
            window._appleObserver.observe(document.body, { childList: true, subtree: true });
          }
        })();
        """ }

    // MARK: - WKScriptMessageHandler — receives tap on injected button

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == "appleSignIn" else { return }
        initiateAppleSignIn()
    }

    // MARK: - Sign in with Apple

    private func initiateAppleSignIn() {
        let nonce = randomNonceString()
        currentNonce = nonce

        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = sha256(nonce)

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }

    // Called by iOS on successful Apple authentication
    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        guard
            let cred      = authorization.credential as? ASAuthorizationAppleIDCredential,
            let tokenData = cred.identityToken,
            let idToken   = String(data: tokenData, encoding: .utf8),
            let nonce     = currentNonce
        else { return }

        // Sanitise values before embedding in JS string literals
        func esc(_ s: String) -> String { s.replacingOccurrences(of: "'", with: "\\'")
                                           .replacingOccurrences(of: "\\", with: "\\\\") }

        let email     = esc(cred.email ?? "")
        let firstName = esc(cred.fullName?.givenName  ?? "")
        let lastName  = esc(cred.fullName?.familyName ?? "")
        let userID    = esc(cred.user)
        let safeToken = esc(idToken)

        // Pass the credential to the web app.
        //
        // The web app should listen for the 'iosAppleSignIn' DOM event and call:
        //   const provider = new OAuthProvider('apple.com');
        //   const credential = provider.credential({ idToken: e.detail.idToken, rawNonce: e.detail.rawNonce });
        //   await signInWithCredential(auth, credential);
        //
        // If window.__iosAppleSignIn is defined, it is called directly (preferred).
        let js = """
        (function() {
          var payload = {
            idToken: '\(safeToken)',
            rawNonce: '\(nonce)',
            email: '\(email)',
            firstName: '\(firstName)',
            lastName: '\(lastName)',
            userIdentifier: '\(userID)'
          };
          if (typeof window.__iosAppleSignIn === 'function') {
            window.__iosAppleSignIn(payload);
          } else {
            window._pendingAppleCredential = payload;
            document.dispatchEvent(new CustomEvent('iosAppleSignIn', { detail: payload }));
          }
        })();
        """
        DispatchQueue.main.async { self.webView.evaluateJavaScript(js) }
    }

    // User cancelled or error — web form remains available, nothing to do
    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {}

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return view.window ?? UIWindow()
    }

    // MARK: - Nonce helpers (required by Apple to prevent replay attacks)

    private func randomNonceString(length: Int = 32) -> String {
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        var remaining = length
        while remaining > 0 {
            (0 ..< 16).forEach { _ in
                var byte: UInt8 = 0
                _ = SecRandomCopyBytes(kSecRandomDefault, 1, &byte)
                if byte < charset.count { result.append(charset[Int(byte)]); remaining -= 1 }
            }
        }
        return result
    }

    private func sha256(_ input: String) -> String {
        SHA256.hash(data: Data(input.utf8))
            .compactMap { String(format: "%02x", $0) }
            .joined()
    }

    // MARK: - Status bar

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    deinit {
        progressObservation?.invalidate()
        pathMonitor?.cancel()
    }
}
