# Bluesky Follower Checker

A web-based tool to check who doesn't follow you back on Bluesky, see who follows you that you don't follow back, create lists of these accounts, and manage your follows.

![Bluesky Logo](https://bsky.app/static/favicon-32x32.png)

## Features

- **Comprehensive Follow Analysis**:
  - Identify accounts you follow that don't follow you back
  - Discover followers you don't follow back
  - Refresh data without logging out
- **Account Information**: 
  - See account names and their following counts for non-followers
  - View post counts for your followers
- **Bulk Actions**: Select multiple accounts to:
  - Unfollow accounts in bulk
  - Follow accounts in bulk
  - Create curated lists for both categories
  - Perform combined actions (create list + follow/unfollow)
- **Whitelist System**: Automatically remember accounts you want to exclude from actions
- **Profile Integration**: Visit any account's profile with a single click
- **Multi-language Support**: Available in English and Turkish
- **Privacy-focused**: All operations happen client-side in your browser
- **Real-time Updates**: Refresh your data anytime without logging out

## Security

This is a client-side only application. Your login credentials are never stored or sent anywhere except directly to Bluesky's API. For enhanced security:

- Use an [App Password](https://bsky.app/settings/app-passwords) instead of your main password
- All account preferences are stored only in your local browser storage

## Usage

1. Open the application in your web browser
2. Log in with your Bluesky account credentials (email/handle and password)
3. The app will analyze your following/follower relationships
4. Switch between tabs to view:
   - **Non-Followers**: Accounts you follow that don't follow you back
   - **Followers You Don't Follow**: Accounts that follow you that you don't follow back
5. Use the checkboxes to select accounts you want to manage
6. Choose from the available actions based on the active tab:
   - For non-followers: Unfollow, Create list, or Both
   - For followers you don't follow: Follow, Create list, or Both
7. Use the "Refresh Data" button to update your follower/following data at any time

## Local Storage

The application uses your browser's local storage to remember:

- Your language preference
- Your whitelist of accounts you've chosen to exclude from actions (separate lists for each tab)

This data remains in your browser and is never transmitted anywhere.

## Technical Details

The application is built using:

- Pure HTML, CSS, and JavaScript (no frameworks)
- Bluesky API interactions for authentication and data operations
- Responsive design that works on both desktop and mobile devices

## Rate Limiting

The application includes built-in rate limiting to respect Bluesky's API limits:
- Maximum of 60 unfollows per minute (1 point each in Bluesky's system)
- Maximum of 60 follows per minute (3 points each in Bluesky's system)
- Automatic pausing between operations with countdown timers
- Hourly and daily limit management

## Latest Updates (April 2025)

- Added "Refresh Data" button to update follower/following data without logging out
- Improved error handling for more reliable operation
- Added null checks to prevent UI errors with missing elements
- Enhanced rate limiting to better comply with Bluesky's latest API guidelines
- Fixed login error handling to provide more accurate feedback

## Contributing

Contributions are welcome! Feel free to submit issues or pull requests.

## License

[MIT License](LICENSE)

## Credits

Developed by [Buğra Canata](https://github.com/bcanata)