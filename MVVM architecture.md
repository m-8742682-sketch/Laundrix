src/
│
├── app/                  # expo-router (screens = Views)
│   ├── (auth)/
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │
│   ├── (chat)/
│   │   ├── chat.tsx
│   │
│   └── _layout.tsx
│
├── viewmodels/           # MVVM brain
│   ├── auth/
│   │   └── AuthViewModel.ts
│   │
│   ├── chat/
│   │   └── ChatViewModel.ts
│   │
│   └── useViewModel.ts   # helper hook
│
├── models/               # business + data layer
│   ├── auth/
│   │   └── authService.ts
│   │
│   ├── chat/
│   │   └── chatService.ts
│   │
│   └── types.ts
│
├── services/             # external dependencies
│   ├── firebase.ts
│   ├── apiClient.ts
│
├── di/                   # dependency injection
│   └── container.ts
│
├── components/           # reusable UI components
│   ├── Button.tsx
│   ├── Avatar.tsx
│
├── hooks/                # generic hooks
│   └── useDebounce.ts
│
├── constants/
│   └── colors.ts
│
└── utils/
    └── formatDate.ts