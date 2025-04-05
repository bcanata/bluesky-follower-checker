# Bluesky Follower Checker

A web-based tool to check who doesn't follow you back on Bluesky, create lists of these accounts, and optionally unfollow them.

![Bluesky Logo](https://bsky.app/static/favicon-32x32.png)

## Features

- **Follow/Follower Analysis**: Quickly identify accounts you follow that don't follow you back
- **Account Information**: See account names and their following counts
- **Bulk Actions**: Select multiple accounts to:
  - Unfollow in bulk
  - Create a curated list of non-followers
  - Both create a list and unfollow at once
- **Whitelist System**: Automatically remember accounts you want to exclude from actions
- **Profile Integration**: Visit any account's profile with a single click
- **Multi-language Support**: Available in English and Turkish
- **Privacy-focused**: All operations happen client-side in your browser

## Security

This is a client-side only application. Your login credentials are never stored or sent anywhere except directly to Bluesky's API. For enhanced security:

- Use an [App Password](https://bsky.app/settings/app-passwords) instead of your main password
- All account preferences are stored only in your local browser storage

## Usage

1. Open the application in your web browser
2. Log in with your Bluesky account credentials (email/handle and password)
3. The app will analyze your following/follower relationships
4. Use the checkbox to select accounts you want to manage
5. Choose one of the available actions:
   - Unfollow selected accounts
   - Create a list of selected accounts
   - Both create a list and unfollow

## Local Storage

The application uses your browser's local storage to remember:

- Your language preference
- Your whitelist of accounts you've explicitly chosen to exclude from actions

This data remains in your browser and is never transmitted anywhere.

## Technical Details

The application is built using:

- Pure HTML, CSS, and JavaScript (no frameworks)
- Bluesky API interactions for authentication and data operations
- Responsive design that works on both desktop and mobile devices

## Rate Limiting

The application includes built-in rate limiting to respect Bluesky's API limits:
- Maximum of 25 unfollows per minute
- Automatic pausing between operations

## Contributing

Contributions are welcome! Feel free to submit issues or pull requests.

## License

[MIT License](LICENSE)

## Credits

Developed by [Buğra Canata](https://github.com/bcanata)