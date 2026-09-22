import { Suspense } from "react";
import AuthScreen from "@/components/auth/AuthScreen";

/** SC-01 ログイン画面。入口は「Google で続ける」1 つで、同意欄は持たない（要件定義書 3.2.1、Task11） */
export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <AuthScreen />
        </Suspense>
    );
}
