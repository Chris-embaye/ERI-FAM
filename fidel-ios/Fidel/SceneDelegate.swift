import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = (scene as? UIWindowScene) else { return }
        window = UIWindow(windowScene: windowScene)

        let learnVC = ViewController()
        learnVC.tabBarItem = UITabBarItem(
            title: "Learn",
            image: UIImage(systemName: "book.fill"),
            tag: 0
        )

        let practiceVC = PracticeViewController()
        let practiceNav = UINavigationController(rootViewController: practiceVC)
        practiceNav.navigationBar.barStyle = .black
        practiceNav.navigationBar.tintColor = UIColor(red: 0.23, green: 0.51, blue: 1.0, alpha: 1)
        practiceNav.tabBarItem = UITabBarItem(
            title: "Practice",
            image: UIImage(systemName: "rectangle.on.rectangle.angled"),
            tag: 1
        )

        let tab = UITabBarController()
        tab.viewControllers = [learnVC, practiceNav]
        tab.tabBar.barStyle = .black
        tab.tabBar.tintColor = UIColor(red: 0.23, green: 0.51, blue: 1.0, alpha: 1)

        window?.rootViewController = tab
        window?.makeKeyAndVisible()
    }
}
