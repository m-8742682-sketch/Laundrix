import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
  verifyPasswordResetCode,
  confirmPasswordReset,
  sendPasswordResetEmail,
  signOut,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { auth } from "@/services/firebase";

export const authDataSource = {
  login(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password);
  },
  async register(email: string, password: string, displayName: string) {
    const res = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(res.user, { displayName });
    await sendEmailVerification(res.user);
    return res.user;
  },
  verifyResetCode(code: string) {
    return verifyPasswordResetCode(auth, code);
  },

  resetPassword(code: string, newPassword: string) {
    return confirmPasswordReset(auth, code, newPassword);
  },

  sendResetEmail(email: string) {
    return sendPasswordResetEmail(auth, email);
  },
  logout() {
    return signOut(auth);
  },

  deleteAccount() {
    if (!auth.currentUser) {
      throw new Error("No authenticated user");
    }
    return deleteUser(auth.currentUser);
  },

  reauthenticate(email: string, password: string) {
    const credential = EmailAuthProvider.credential(
      email,
      password
    );

    return reauthenticateWithCredential(
      auth.currentUser!,
      credential
    );
  },
};