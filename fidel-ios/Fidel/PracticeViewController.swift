import UIKit

struct Word: Codable {
    let tigrinya: String
    let english: String
    let romanized: String
}

class PracticeViewController: UIViewController {

    private var words: [Word] = []
    private var currentIndex = 0
    private var knownIndices: Set<Int> = []
    private var isFlipped = false

    private let progressView = UIProgressView(progressViewStyle: .default)
    private let statusLabel = UILabel()
    private let cardView = UIView()
    private let tigrinyaLabel = UILabel()
    private let englishLabel = UILabel()
    private let romanizedLabel = UILabel()
    private let tapHintLabel = UILabel()
    private let knowButton = UIButton(type: .system)
    private let againButton = UIButton(type: .system)

    private let accent = UIColor(red: 0.23, green: 0.51, blue: 1.0, alpha: 1)
    private let bg = UIColor(red: 0.07, green: 0.07, blue: 0.12, alpha: 1)
    private let cardBg = UIColor(red: 0.12, green: 0.12, blue: 0.20, alpha: 1)

    override func viewDidLoad() {
        super.viewDidLoad()
        loadWords()
        setupUI()
        showCard()
    }

    private func loadWords() {
        guard let url = Bundle.main.url(forResource: "Words", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode([Word].self, from: data) else { return }
        words = decoded.shuffled()
        let saved = UserDefaults.standard.array(forKey: "knownIndices") as? [Int] ?? []
        knownIndices = Set(saved)
    }

    private func saveProgress() {
        UserDefaults.standard.set(Array(knownIndices), forKey: "knownIndices")
    }

    private func setupUI() {
        view.backgroundColor = bg
        title = "Practice"
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            title: "Reset", style: .plain, target: self, action: #selector(confirmReset)
        )

        progressView.translatesAutoresizingMaskIntoConstraints = false
        progressView.progressTintColor = accent
        progressView.trackTintColor = UIColor.white.withAlphaComponent(0.1)
        view.addSubview(progressView)

        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.textColor = UIColor.white.withAlphaComponent(0.55)
        statusLabel.font = .systemFont(ofSize: 14)
        statusLabel.textAlignment = .center
        view.addSubview(statusLabel)

        cardView.translatesAutoresizingMaskIntoConstraints = false
        cardView.backgroundColor = cardBg
        cardView.layer.cornerRadius = 22
        cardView.layer.shadowColor = UIColor.black.cgColor
        cardView.layer.shadowOpacity = 0.35
        cardView.layer.shadowRadius = 18
        cardView.layer.shadowOffset = CGSize(width: 0, height: 6)
        cardView.isUserInteractionEnabled = true
        cardView.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(flipCard)))
        view.addSubview(cardView)

        tigrinyaLabel.translatesAutoresizingMaskIntoConstraints = false
        tigrinyaLabel.textColor = .white
        tigrinyaLabel.font = .systemFont(ofSize: 44, weight: .bold)
        tigrinyaLabel.textAlignment = .center
        tigrinyaLabel.numberOfLines = 3
        tigrinyaLabel.adjustsFontSizeToFitWidth = true
        tigrinyaLabel.minimumScaleFactor = 0.6
        cardView.addSubview(tigrinyaLabel)

        englishLabel.translatesAutoresizingMaskIntoConstraints = false
        englishLabel.textColor = accent
        englishLabel.font = .systemFont(ofSize: 28, weight: .semibold)
        englishLabel.textAlignment = .center
        englishLabel.numberOfLines = 3
        englishLabel.isHidden = true
        cardView.addSubview(englishLabel)

        romanizedLabel.translatesAutoresizingMaskIntoConstraints = false
        romanizedLabel.textColor = UIColor.white.withAlphaComponent(0.45)
        romanizedLabel.font = .italicSystemFont(ofSize: 18)
        romanizedLabel.textAlignment = .center
        romanizedLabel.isHidden = true
        cardView.addSubview(romanizedLabel)

        tapHintLabel.translatesAutoresizingMaskIntoConstraints = false
        tapHintLabel.text = "Tap to reveal translation"
        tapHintLabel.textColor = UIColor.white.withAlphaComponent(0.3)
        tapHintLabel.font = .systemFont(ofSize: 13)
        tapHintLabel.textAlignment = .center
        cardView.addSubview(tapHintLabel)

        knowButton.translatesAutoresizingMaskIntoConstraints = false
        knowButton.setTitle("✓  I know it", for: .normal)
        knowButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        knowButton.backgroundColor = UIColor(red: 0.12, green: 0.55, blue: 0.32, alpha: 1)
        knowButton.setTitleColor(.white, for: .normal)
        knowButton.layer.cornerRadius = 14
        knowButton.isHidden = true
        knowButton.addTarget(self, action: #selector(markKnown), for: .touchUpInside)
        view.addSubview(knowButton)

        againButton.translatesAutoresizingMaskIntoConstraints = false
        againButton.setTitle("↩  Again", for: .normal)
        againButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        againButton.backgroundColor = UIColor(red: 0.55, green: 0.13, blue: 0.13, alpha: 1)
        againButton.setTitleColor(.white, for: .normal)
        againButton.layer.cornerRadius = 14
        againButton.isHidden = true
        againButton.addTarget(self, action: #selector(markAgain), for: .touchUpInside)
        view.addSubview(againButton)

        let safeTop = view.safeAreaLayoutGuide.topAnchor
        NSLayoutConstraint.activate([
            progressView.topAnchor.constraint(equalTo: safeTop, constant: 14),
            progressView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            progressView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),

            statusLabel.topAnchor.constraint(equalTo: progressView.bottomAnchor, constant: 8),
            statusLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            statusLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor),

            cardView.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 20),
            cardView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            cardView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            cardView.heightAnchor.constraint(equalTo: view.heightAnchor, multiplier: 0.44),

            tigrinyaLabel.centerXAnchor.constraint(equalTo: cardView.centerXAnchor),
            tigrinyaLabel.centerYAnchor.constraint(equalTo: cardView.centerYAnchor, constant: -10),
            tigrinyaLabel.leadingAnchor.constraint(equalTo: cardView.leadingAnchor, constant: 24),
            tigrinyaLabel.trailingAnchor.constraint(equalTo: cardView.trailingAnchor, constant: -24),

            englishLabel.centerXAnchor.constraint(equalTo: cardView.centerXAnchor),
            englishLabel.centerYAnchor.constraint(equalTo: cardView.centerYAnchor, constant: -20),
            englishLabel.leadingAnchor.constraint(equalTo: cardView.leadingAnchor, constant: 24),
            englishLabel.trailingAnchor.constraint(equalTo: cardView.trailingAnchor, constant: -24),

            romanizedLabel.topAnchor.constraint(equalTo: englishLabel.bottomAnchor, constant: 10),
            romanizedLabel.centerXAnchor.constraint(equalTo: cardView.centerXAnchor),

            tapHintLabel.bottomAnchor.constraint(equalTo: cardView.bottomAnchor, constant: -18),
            tapHintLabel.centerXAnchor.constraint(equalTo: cardView.centerXAnchor),

            knowButton.topAnchor.constraint(equalTo: cardView.bottomAnchor, constant: 20),
            knowButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            knowButton.trailingAnchor.constraint(equalTo: view.centerXAnchor, constant: -8),
            knowButton.heightAnchor.constraint(equalToConstant: 56),

            againButton.topAnchor.constraint(equalTo: cardView.bottomAnchor, constant: 20),
            againButton.leadingAnchor.constraint(equalTo: view.centerXAnchor, constant: 8),
            againButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            againButton.heightAnchor.constraint(equalToConstant: 56),
        ])
    }

    private func showCard() {
        guard currentIndex < words.count else { showCompletion(); return }

        let word = words[currentIndex]
        tigrinyaLabel.text = word.tigrinya
        englishLabel.text = word.english
        romanizedLabel.text = word.romanized

        isFlipped = false
        tigrinyaLabel.isHidden = false
        englishLabel.isHidden = true
        romanizedLabel.isHidden = true
        tapHintLabel.isHidden = false
        knowButton.isHidden = true
        againButton.isHidden = true

        let pct = Float(currentIndex) / Float(words.count)
        progressView.setProgress(pct, animated: true)
        statusLabel.text = "Card \(currentIndex + 1) of \(words.count)  ·  \(knownIndices.count) known"
    }

    @objc private func flipCard() {
        guard !isFlipped else { return }
        isFlipped = true

        UIView.transition(with: cardView, duration: 0.4, options: .transitionFlipFromRight) {
            self.tigrinyaLabel.isHidden = true
            self.englishLabel.isHidden = false
            self.romanizedLabel.isHidden = false
            self.tapHintLabel.isHidden = true
        }
        UIView.animate(withDuration: 0.25, delay: 0.25) {
            self.knowButton.isHidden = false
            self.againButton.isHidden = false
        }
    }

    @objc private func markKnown() {
        knownIndices.insert(currentIndex)
        saveProgress()
        advance()
    }

    @objc private func markAgain() {
        advance()
    }

    private func advance() {
        currentIndex += 1
        UIView.animate(withDuration: 0.18, animations: {
            self.cardView.transform = CGAffineTransform(translationX: -self.view.bounds.width, y: 0)
            self.cardView.alpha = 0
        }) { _ in
            self.cardView.transform = CGAffineTransform(translationX: self.view.bounds.width, y: 0)
            self.showCard()
            UIView.animate(withDuration: 0.18) {
                self.cardView.transform = .identity
                self.cardView.alpha = 1
            }
        }
    }

    @objc private func confirmReset() {
        let alert = UIAlertController(title: "Reset Progress?", message: "This will clear all saved progress.", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        alert.addAction(UIAlertAction(title: "Reset", style: .destructive) { _ in
            self.knownIndices = []
            self.currentIndex = 0
            self.words.shuffle()
            self.saveProgress()
            self.showCard()
        })
        present(alert, animated: true)
    }

    private func showCompletion() {
        progressView.setProgress(1.0, animated: true)
        let total = words.count
        let known = knownIndices.count
        let msg = known == total
            ? "Perfect! You know all \(total) words!"
            : "You knew \(known) of \(total) words. Keep going!"
        let alert = UIAlertController(title: "Round Complete 🎉", message: msg, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Practice Again", style: .default) { _ in
            self.currentIndex = 0
            self.words.shuffle()
            self.showCard()
        })
        present(alert, animated: true)
    }
}
