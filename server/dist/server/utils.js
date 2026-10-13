export function ok(data) {
    return { success: true, data };
}
export function fail(error) {
    return { success: false, error };
}
export function publicUser(user) {
    const { password: _password, ...safeUser } = user;
    return safeUser;
}
export function id(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
