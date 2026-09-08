"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const STORY_RING = "linear-gradient(45deg, #feda75, #fa7e1e, #d62976, #962fbf, #4f5bd5)";

function Avatar({
    label,
    ring = false,
    size = 56,
    gradient,
}: {
    label: string;
    ring?: boolean;
    size?: number;
    gradient: string;
}) {
    return (
        <div
            className="flex shrink-0 items-center justify-center rounded-full"
            style={{
                width: size,
                height: size,
                padding: ring ? 2.5 : 0,
                background: ring ? STORY_RING : "transparent",
            }}
        >
            <div
                className="flex h-full w-full items-center justify-center rounded-full text-sm font-semibold text-white ring-2 ring-white"
                style={{ background: gradient }}
            >
                {label}
            </div>
        </div>
    );
}

function HeartIcon({ filled }: { filled: boolean }) {
    return filled ? (
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-[#ed4956] text-[#ed4956]">
            <path d="M12 21s-6.7-4.35-9.33-8.2C.86 10.1 1.2 6.6 4 4.8c2.2-1.4 4.9-.7 6.4 1.1.5.6.9 1.2 1.6 1.2s1.1-.6 1.6-1.2c1.5-1.8 4.2-2.5 6.4-1.1 2.8 1.8 3.14 5.3 1.33 8-2.63 3.85-9.33 8.2-9.33 8.2z" />
        </svg>
    ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-6 w-6">
            <path d="M12 21s-6.7-4.35-9.33-8.2C.86 10.1 1.2 6.6 4 4.8c2.2-1.4 4.9-.7 6.4 1.1.5.6.9 1.2 1.6 1.2s1.1-.6 1.6-1.2c1.5-1.8 4.2-2.5 6.4-1.1 2.8 1.8 3.14 5.3 1.33 8-2.63 3.85-9.33 8.2-9.33 8.2z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function CommentIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-6 w-6">
            <path d="M20.66 12A8.66 8.66 0 1 1 3.87 7.6a8.67 8.67 0 0 1 15.6 3.1 8.9 8.9 0 0 1 1.19 1.3z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 3.6a8.7 8.7 0 0 0-8.4 6.53" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function SendIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-6 w-6">
            <line x1="22" y1="2" x2="9.2" y2="14.8" strokeLinecap="round" strokeLinejoin="round" />
            <polygon points="22 2 15.2 22 9.2 14.8 2 8.8 22 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
    return (
        <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.7} className="h-6 w-6">
            <path d="M19 21 12 16 5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function HomeIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
            <path d="M12 2.6 1.5 11h3V21h6v-6h3v6h6V11h3z" />
        </svg>
    );
}

function SearchIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="h-6 w-6">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.6" y2="16.6" strokeLinecap="round" />
        </svg>
    );
}

function PlusSquareIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-6 w-6">
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <line x1="12" y1="8" x2="12" y2="16" strokeLinecap="round" />
            <line x1="8" y1="12" x2="16" y2="12" strokeLinecap="round" />
        </svg>
    );
}

type Post = {
    id: string;
    author: string;
    location: string;
    gradient: string;
    emoji: string;
    caption: string;
    likes: number;
    comments: number;
    time: string;
};

const POSTS: Post[] = [
    {
        id: "p1",
        author: "kyoto_wanderer",
        location: "京都府 清水寺",
        gradient: "linear-gradient(135deg,#ff9966,#ff5e62)",
        emoji: "🍁",
        caption: "秋の京都、紅葉が綺麗すぎた…！ #京都旅行 #紅葉",
        likes: 128,
        comments: 12,
        time: "2時間前",
    },
    {
        id: "p2",
        author: "okinawa_blue",
        location: "沖縄県 瀬底島",
        gradient: "linear-gradient(135deg,#43cea2,#185a9d)",
        emoji: "🌊",
        caption: "沖縄の海は何度来ても最高✨ #沖縄 #離島旅行",
        likes: 342,
        comments: 28,
        time: "5時間前",
    },
    {
        id: "p3",
        author: "hokkaido_snow",
        location: "北海道 富良野",
        gradient: "linear-gradient(135deg,#83a4d4,#b6fbff)",
        emoji: "❄️",
        caption: "雪景色に感動した1日でした #北海道 #冬旅",
        likes: 96,
        comments: 6,
        time: "1日前",
    },
];

const AVATAR_GRADIENTS = [
    "linear-gradient(135deg,#f6d365,#fda085)",
    "linear-gradient(135deg,#a1c4fd,#c2e9fb)",
    "linear-gradient(135deg,#fbc2eb,#a6c1ee)",
    "linear-gradient(135deg,#84fab0,#8fd3f4)",
];

const STORIES = [
    { name: "hana", gradient: AVATAR_GRADIENTS[0] },
    { name: "riku", gradient: AVATAR_GRADIENTS[1] },
    { name: "mei", gradient: AVATAR_GRADIENTS[2] },
    { name: "sora", gradient: AVATAR_GRADIENTS[3] },
];

export default function InstagramHome({ username }: { username: string }) {
    const router = useRouter();
    const supabase = createClient();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [likes, setLikes] = useState<Record<string, { liked: boolean; count: number }>>(() =>
        Object.fromEntries(POSTS.map((p) => [p.id, { liked: false, count: p.likes }]))
    );
    const [saved, setSaved] = useState<Record<string, boolean>>({});

    const initial = username.trim().charAt(0).toUpperCase() || "T";

    const toggleLike = (id: string) => {
        setLikes((prev) => {
            const current = prev[id];
            return {
                ...prev,
                [id]: {
                    liked: !current.liked,
                    count: current.liked ? current.count - 1 : current.count + 1,
                },
            };
        });
    };

    const handleLogout = async () => {
        setIsLoggingOut(true);
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
    };

    return (
        <div className="min-h-screen w-full bg-white text-gray-900 sm:bg-[#fafafa]">
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur">
                <h1
                    className="text-2xl font-semibold tracking-tight"
                    style={{ fontFamily: "'Brush Script MT', cursive" }}
                >
                    タビコエ
                </h1>
                <div className="flex items-center gap-4">
                    <HeartIcon filled={false} />
                    <SendIcon />
                    <button
                        type="button"
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        title="ログアウト"
                        className="text-xs font-semibold text-[#0095F6] disabled:opacity-50"
                    >
                        {isLoggingOut ? "..." : "ログアウト"}
                    </button>
                </div>
            </header>

            <main className="mx-auto w-full max-w-[470px] pb-20 sm:pt-4">
                <div className="flex gap-4 overflow-x-auto border-b border-gray-200 bg-white px-4 py-3 sm:rounded-sm sm:border">
                    <div className="flex shrink-0 flex-col items-center gap-1">
                        <Avatar label={initial} gradient="linear-gradient(135deg,#0095F6,#00c6ff)" size={56} />
                        <span className="max-w-[64px] truncate text-xs text-gray-600">あなた</span>
                    </div>
                    {STORIES.map((s) => (
                        <div key={s.name} className="flex shrink-0 flex-col items-center gap-1">
                            <Avatar label={s.name.charAt(0).toUpperCase()} ring gradient={s.gradient} size={56} />
                            <span className="max-w-[64px] truncate text-xs text-gray-600">{s.name}</span>
                        </div>
                    ))}
                </div>

                <div className="flex flex-col">
                    {POSTS.map((post) => {
                        const like = likes[post.id];
                        const isSaved = !!saved[post.id];
                        return (
                            <article
                                key={post.id}
                                className="border-b border-gray-200 bg-white pb-3 sm:mt-4 sm:rounded-sm sm:border"
                            >
                                <div className="flex items-center gap-3 px-3 py-3">
                                    <Avatar label={post.author.charAt(0).toUpperCase()} ring gradient={AVATAR_GRADIENTS[0]} size={36} />
                                    <div className="flex flex-col leading-tight">
                                        <span className="text-sm font-semibold">{post.author}</span>
                                        <span className="text-xs text-gray-500">{post.location}</span>
                                    </div>
                                </div>

                                <div
                                    onDoubleClick={() => !like.liked && toggleLike(post.id)}
                                    className="flex aspect-square w-full items-center justify-center text-6xl"
                                    style={{ background: post.gradient }}
                                >
                                    {post.emoji}
                                </div>

                                <div className="flex items-center justify-between px-3 pt-2">
                                    <div className="flex items-center gap-4">
                                        <button type="button" onClick={() => toggleLike(post.id)} aria-label="いいね">
                                            <HeartIcon filled={like.liked} />
                                        </button>
                                        <button type="button" aria-label="コメント">
                                            <CommentIcon />
                                        </button>
                                        <button type="button" aria-label="シェア">
                                            <SendIcon />
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSaved((prev) => ({ ...prev, [post.id]: !prev[post.id] }))}
                                        aria-label="保存"
                                    >
                                        <BookmarkIcon filled={isSaved} />
                                    </button>
                                </div>

                                <div className="px-3 pt-2 text-sm">
                                    <p className="font-semibold">{like.count.toLocaleString()}件のいいね</p>
                                    <p className="mt-1">
                                        <span className="font-semibold">{post.author}</span> {post.caption}
                                    </p>
                                    <p className="mt-1 text-gray-500">コメント{post.comments}件をすべて見る</p>
                                    <p className="mt-1 text-[11px] uppercase text-gray-400">{post.time}</p>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </main>

            <nav className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-around border-t border-gray-200 bg-white/95 py-2.5 backdrop-blur">
                <button type="button" aria-label="ホーム">
                    <HomeIcon />
                </button>
                <button type="button" aria-label="検索">
                    <SearchIcon />
                </button>
                <button type="button" aria-label="投稿">
                    <PlusSquareIcon />
                </button>
                <button type="button" aria-label="いいね">
                    <HeartIcon filled={false} />
                </button>
                <button type="button" onClick={handleLogout} title="ログアウト" aria-label="プロフィール">
                    <Avatar label={initial} gradient="linear-gradient(135deg,#0095F6,#00c6ff)" size={26} />
                </button>
            </nav>
        </div>
    );
}
