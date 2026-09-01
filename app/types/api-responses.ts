import type { User } from "~/store/auth"

export interface LoginResponseT {
  token: string
  data?: {
    user: User
  }
}

export interface SignupResponseT {
  token: string
  data: {
    // Present when a brand new account was created
    newUser?: User
    // Present when the Google account is already linked to an existing user
    user?: User
  }
}

export interface GoogleAuthResponseT {
  token: string
  data?: {
    user: User
  }
}

export interface ApiErrorT {
  data?: {
    message: string
    error: string
  }
}

// interface FirebaseUser {
//   uid: string;
//   email: string | null;
//   emailVerified: boolean;
//   displayName: string | null;
//   photoURL: string | null;
//   phoneNumber: string | null;
//   isAnonymous: boolean;
//   tenantId: string | null;
//   providerId: string;
//   refreshToken: string;
//   metadata: {
//     creationTime: string;
//     lastSignInTime: string;
//   };
//   providerData: Array<{
//     uid: string;
//     displayName: string | null;
//     email: string | null;
//     phoneNumber: string | null;
//     photoURL: string | null;
//     providerId: string;
//   }>;
// }

// interface UserCredentialT {
// user: FirebaseUser
// operationType: 'signIn' | 'link' | 'reauthenticate';
// providerId: string | null;
// credential: {
//   accessToken?: string;
//   idToken?: string;
//   providerId: string;
//   signInMethod: string;
// } | null;
// }
