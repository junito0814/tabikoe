import { Suspense } from "react";
import AuthScreen from "@/components/auth/AuthScreen";

/** SC-20 アカウント新規作成画面。同意欄はこの画面にのみ置く（要件定義書3.2.1、v2.8） */
export default function SignupPage() {
    return (
        <Suspense fallback={null}>
            <AuthScreen mode="signup" />
        </Suspense>
    );
}
