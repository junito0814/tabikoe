import { Suspense } from "react";
import AuthScreen from "@/components/auth/AuthScreen";

/** SC-01 ログイン画面。同意欄は持たない（要件定義書3.2.1、v2.8） */
export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <AuthScreen mode="login" />
        </Suspense>
    );
}
