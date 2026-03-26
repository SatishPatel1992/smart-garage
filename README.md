# Smart Garage – SaaS Mobile App

Mobile app for garage workflow: **job cards**, **estimates**, **invoices**, **billing**, and **vehicle delivery**.

## Tech stack

- **React Native** with **Expo** (SDK 52)
- **TypeScript**
- **React Navigation** (native stack)

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Start the app**

   ```bash
   npx expo start
   ```

3. Run on a device or simulator:
   - Press `a` for Android
   - Press `i` for iOS
   - Or scan the QR code with **Expo Go** on your phone

## Project structure

```
smart-garage/
├── App.tsx                 # App entry, navigation setup
├── app.json                # Expo config
├── src/
│   └── screens/
│       └── LoginScreen.tsx # Email/password login
└── package.json
```

## Login screen

- Email and password fields
- Basic validation (required fields, email format)
- Show/hide password
- Loading state and placeholder submit (ready to plug in your auth API)

## Next steps

- Add auth API (e.g. login endpoint) in `LoginScreen.tsx`
- Add screens: Job cards, Estimates, Invoices, Billing, Vehicle delivery
- Add app icon and splash in `app.json` and `./assets/` when ready
