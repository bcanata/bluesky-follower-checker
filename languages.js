// Language configuration for Bluesky Follower Checker
const languages = {
    en: {
        // Login and general UI
        title: "Bluesky Follower Checker",
        description: "Check who doesn't follow you back on Bluesky, create lists, and unfollow accounts.",
        securityNote: "This is a client-side app. Your login credentials are never stored or sent to any server except Bluesky's API. The code runs entirely in your browser.",
        login: "Login to Bluesky",
        identifier: "Email or Handle:",
        identifierPlaceholder: "you@example.com or you.bsky.social",
        password: "Password or App Password:",
        passwordPlaceholder: "password",
        appPasswordTip: 'Tip: Using an <a href="https://bsky.app/settings/app-passwords" target="_blank">App Password</a> is recommended for security.',
        whitelistInfo: "When you uncheck accounts, they will be remembered and automatically unchecked next time you use the tool. Your whitelist is saved in your browser.",
        loginButton: "Login & Check Followers",
        logout: "Logout",
        
        // Tabs
        tabNonFollowers: "Non-Followers",
        tabActions: "Actions",
        
        // Stats and user info
        loggedInAs: "Logged in as @{handle}",
        followStats: "You follow <strong>{follows}</strong> accounts and have <strong>{followers}</strong> followers.",
        nonFollowersCount: "Accounts that don't follow you back: {count}",
        whitelistedCount: "{count} accounts have been whitelisted",
        loadFollowCounts: "Load Following Counts",
        refreshFollowCounts: "Refresh Following Counts",
        loadingFollowCounts: "Loading following counts... {progress}%",
        
        // Table headers
        selectAll: "Select/Deselect All",
        account: "Account",
        follows: "Follows",
        followsCount: "{count} accounts",
        visitProfile: "Visit Profile",
        
        // Actions
        whatToDo: "What would you like to do with selected accounts?",
        unfollowButton: "Unfollow Selected ({count})",
        createListButton: "Create List ({count})",
        bothButton: "Both (List & Unfollow) ({count})",
        confirmUnfollow: "Are you sure you want to unfollow {count} accounts?",
        confirmBoth: "Are you sure you want to create a list and unfollow {count} accounts?",
        processing: "Processing...",
        minute: "Minute {count}",
        rateLimitReached: "Rate limit reached. Waiting {seconds} seconds...",
        continuing: "Continuing...",
        unfollowing: "Unfollowing @{handle} ({current}/{total})...",
        
        // List creation
        creatingList: 'Creating list "{name}"...',
        listCreated: "List created! Adding {count} accounts...",
        nonFollowerListName: "Non-followers {date}",
        nonFollowerListDescription: "Accounts that don't follow me back (as of {date})",
        
        // Results
        results: "Results:",
        listCreationResults: "List Creation:",
        listCreatedSuccess: "List created successfully!",
        accountsAdded: "Added {count} accounts to the list",
        failedToAdd: "Failed to add {count} accounts",
        viewList: "View List on Bluesky",
        failedToCreateList: "Failed to create list",
        unfollowResults: "Unfollow Results:",
        successfullyUnfollowed: "Successfully unfollowed: {count}",
        failedToUnfollow: "Failed to unfollow: {count}",
        
        // Errors and confirmations
        enterCredentials: "Please enter your email/handle and password",
        confirmLogout: "Are you sure you want to log out?",
        loginFailed: "Login failed. Please check your credentials.",
        apiError: "API request failed: {message}",
        errorLoadingCounts: "Error loading following counts: {message}",
        errorUnfollowing: "Error unfollowing accounts: {message}",
        errorCreatingList: "Error creating list: {message}",
        errorGeneric: "Error: {message}",
        errorReloading: "Error reloading data: {message}",
        
        // Language selection
        languageSelector: "Language:",
        english: "English",
        turkish: "Turkish",
        
        // Footer
        footer: 'Made with ❤️ | <a href="https://github.com/bcanata/bluesky-follower-checker" target="_blank">View on GitHub</a>'
    },
    tr: {
        // Login and general UI
        title: "Bluesky Takipçi Kontrolcüsü",
        description: "Bluesky'da sizi geri takip etmeyenleri kontrol edin, listeler oluşturun ve hesapları takipten çıkarın.",
        securityNote: "Bu tamamen istemci taraflı bir uygulamadır. Giriş bilgileriniz asla saklanmaz veya Bluesky API'si dışında herhangi bir sunucuya gönderilmez. Kod tamamen tarayıcınızda çalışır.",
        login: "Bluesky'a Giriş Yap",
        identifier: "E-posta veya Kullanıcı Adı:",
        identifierPlaceholder: "siz@ornek.com veya siz.bsky.social",
        password: "Parola veya Uygulama Parolası:",
        passwordPlaceholder: "parola",
        appPasswordTip: 'İpucu: Güvenlik için <a href="https://bsky.app/settings/app-passwords" target="_blank">Uygulama Parolası</a> kullanmanız önerilir.',
        whitelistInfo: "Bir hesabın işaretini kaldırırsanız, bu hatırlanacak ve aracı bir sonraki kullanışınızda otomatik olarak işaretsiz olacaktır. Beyaz listeniz tarayıcınızda saklanır.",
        loginButton: "Giriş Yap ve Takipçileri Kontrol Et",
        logout: "Çıkış Yap",
        
        // Tabs
        tabNonFollowers: "Takip Etmeyenler",
        tabActions: "İşlemler",
        
        // Stats and user info
        loggedInAs: "@{handle} olarak giriş yapıldı",
        followStats: "<strong>{follows}</strong> hesabı takip ediyorsunuz ve <strong>{followers}</strong> takipçiniz var.",
        nonFollowersCount: "Sizi geri takip etmeyen hesaplar: {count}",
        whitelistedCount: "{count} hesap beyaz listeye alındı",
        loadFollowCounts: "Takip Sayılarını Yükle",
        refreshFollowCounts: "Takip Sayılarını Yenile",
        loadingFollowCounts: "Takip sayıları yükleniyor... %{progress}",
        
        // Table headers
        selectAll: "Tümünü Seç/Kaldır",
        account: "Hesap",
        follows: "Takip",
        followsCount: "{count} hesap",
        visitProfile: "Profili Ziyaret Et",
        
        // Actions
        whatToDo: "Seçili hesaplarla ne yapmak istersiniz?",
        unfollowButton: "Seçilenleri Takipten Çıkar ({count})",
        createListButton: "Liste Oluştur ({count})",
        bothButton: "Her İkisi de (Liste ve Takipten Çıkarma) ({count})",
        confirmUnfollow: "{count} hesabı takipten çıkarmak istediğinizden emin misiniz?",
        confirmBoth: "Liste oluşturmak ve {count} hesabı takipten çıkarmak istediğinizden emin misiniz?",
        processing: "İşleniyor...",
        minute: "Dakika {count}",
        rateLimitReached: "Hız limiti aşıldı. {seconds} saniye bekleniyor...",
        continuing: "Devam ediliyor...",
        unfollowing: "@{handle} takipten çıkarılıyor ({current}/{total})...",
        
        // List creation
        creatingList: '"{name}" listesi oluşturuluyor...',
        listCreated: "Liste oluşturuldu! {count} hesap ekleniyor...",
        nonFollowerListName: "Takip Etmeyenler {date}",
        nonFollowerListDescription: "Beni geri takip etmeyen hesaplar ({date} itibariyle)",
        
        // Results
        results: "Sonuçlar:",
        listCreationResults: "Liste Oluşturma:",
        listCreatedSuccess: "Liste başarıyla oluşturuldu!",
        accountsAdded: "Listeye {count} hesap eklendi",
        failedToAdd: "{count} hesap eklenemedi",
        viewList: "Listeyi Bluesky'da Görüntüle",
        failedToCreateList: "Liste oluşturulamadı",
        unfollowResults: "Takipten Çıkarma Sonuçları:",
        successfullyUnfollowed: "Başarıyla takipten çıkarıldı: {count}",
        failedToUnfollow: "Takipten çıkarılamadı: {count}",
        
        // Errors and confirmations
        enterCredentials: "Lütfen e-posta/kullanıcı adı ve parolanızı girin",
        confirmLogout: "Çıkış yapmak istediğinizden emin misiniz?",
        loginFailed: "Giriş başarısız. Lütfen bilgilerinizi kontrol edin.",
        apiError: "API isteği başarısız: {message}",
        errorLoadingCounts: "Takip sayıları yüklenirken hata: {message}",
        errorUnfollowing: "Hesaplar takipten çıkarılırken hata: {message}",
        errorCreatingList: "Liste oluşturulurken hata: {message}",
        errorGeneric: "Hata: {message}",
        errorReloading: "Veriler yeniden yüklenirken hata: {message}",
        
        // Language selection
        languageSelector: "Dil:",
        english: "İngilizce",
        turkish: "Türkçe",
        
        // Footer
        footer: '❤️ ile yapıldı | <a href="https://github.com/bcanata/bluesky-follower-checker" target="_blank">GitHub\'da görüntüle</a>'
    }
};