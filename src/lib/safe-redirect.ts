/**
 * ログイン後の遷移先として安全なパスのみを許可する。
 * 外部ドメインへのオープンリダイレクトを防ぐため、"/"始まりかつ"//"始まりでないものだけ許可する。
 */
export function safeRedirectPath(path: string | null): string {
    if (path && path.startsWith("/") && !path.startsWith("//")) {
        return path;
    }
    return "/";
}
