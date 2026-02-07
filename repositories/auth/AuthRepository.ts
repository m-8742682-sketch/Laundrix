import { authDataSource } from "@/datasources/remote/firebase/authDataSource";

export class AuthRepository {
  async login(email: string, password: string) {
    const result = await authDataSource.login(email, password);

    if (!result.user.emailVerified) {
      throw { code: "auth/email-not-verified" };
    }

    return result.user;
  }

  async register(email: string, password: string) {
    const username = email.split("@")[0];
    return authDataSource.register(email, password, username);
  }

  verifyResetCode(code: string) {
    return authDataSource.verifyResetCode(code);
  }

  resetPassword(code: string, newPassword: string) {
    return authDataSource.resetPassword(code, newPassword);
  }
  sendResetEmail(email: string) {
    return authDataSource.sendResetEmail(email);
  }

  logout() {
    return authDataSource.logout();
  }

  async deleteAccount() {
    return authDataSource.deleteAccount();
  }

  async reauthenticate(email: string, password: string) {
    return authDataSource.reauthenticate(email, password);
  }
}