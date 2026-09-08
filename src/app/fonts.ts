import { Outfit, Lora } from "next/font/google";

export const outfit = Outfit({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
});

export const lora = Lora({
    subsets: ["latin"],
    weight: ["600", "700"],
});
