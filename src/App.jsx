import React, { useEffect, useState, useRef, useCallback } from "react";
import { initializeApp } from "firebase/app";
import {
    getAuth,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
} from "firebase/auth";
import {
    getFirestore,
    collection,
    addDoc,
    deleteDoc,
    doc,
    updateDoc,
    onSnapshot,
    writeBatch,
} from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyAkjjrS6GrqmkqQHcma2IiDJk1kP6RBm7o",
    authDomain: "book-tracker-cbf62.firebaseapp.com",
    projectId: "book-tracker-cbf62",
    storageBucket: "book-tracker-cbf62.firebasestorage.app",
    messagingSenderId: "557333582609",
    appId: "1:557333582609:web:133040f540fe867847f2b0",
    measurementId: "G-ZH1KET1K3S",
};

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "editor@tbrgrid.local";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const cols = [
    {
        id: "narrative-available",
        title: "Narrative / Available",
        available: true,
        narrative: true,
    },
    {
        id: "non-narrative-available",
        title: "Non-Narrative / Available",
        available: true,
        narrative: false,
    },
    {
        id: "narrative-unavailable",
        title: "Narrative / Unavailable",
        available: false,
        narrative: true,
    },
    {
        id: "non-narrative-unavailable",
        title: "Non-Narrative / Unavailable",
        available: false,
        narrative: false,
    },
];

function isStarred(book) {
    return book.starred ?? book.top3 ?? false;
}

function useScrollLock(active) {
    useEffect(() => {
        if (!active) return;
        document.documentElement.classList.add("scroll-locked");
        return () => document.documentElement.classList.remove("scroll-locked");
    }, [active]);
}

function bookUrl(book) {
    if (book.openLibraryUrl) return book.openLibraryUrl;
    const q = encodeURIComponent(`${book.title} ${book.author || ""}`.trim());
    return `https://www.google.com/search?tbm=bks&q=${q}`;
}

// ── Icons ────────────────────────────────────────────────────
function BookIcon({ size = 14, opacity = 0.3 }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ opacity }}
        >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
    );
}

function StarIcon({ filled }) {
    return filled ? (
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1"
        >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    ) : (
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
        >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    );
}

function ReadingIcon() {
    return (
        <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
        >
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
    );
}

function CloseIcon() {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
        >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    );
}

function DeleteIcon() {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    );
}

function SpinnerIcon() {
    return (
        <svg
            className="spin"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
        >
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
        </svg>
    );
}

// ── Auth gate ────────────────────────────────────────────────
function AuthGate({ onClose, onSuccess }) {
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useScrollLock(true);

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
            onSuccess();
        } catch {
            setError("Wrong password");
        }
        setLoading(false);
    }

    return (
        <div className="auth-backdrop" onClick={onClose}>
            <form
                className="auth-sheet"
                onClick={(e) => e.stopPropagation()}
                onSubmit={handleSubmit}
            >
                <p className="auth-label">Enter password to edit</p>
                <input
                    className="auth-input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                    placeholder="Password"
                />
                {error && <p className="auth-error">{error}</p>}
                <button
                    className="auth-submit"
                    type="submit"
                    disabled={loading || !password}
                >
                    {loading ? "…" : "Unlock"}
                </button>
            </form>
        </div>
    );
}

// ── Book Card ────────────────────────────────────────────────
function BookCard({
    book,
    canEdit,
    toggleAvailable,
    toggleNarrative,
    toggleReading,
    toggleAua,
    toggleStarred,
    toggleBookstore,
    deleteBook,
}) {
    const starred = isStarred(book);

    function handleCoverClick(e) {
        e.stopPropagation();
        window.open(bookUrl(book), "_blank", "noopener,noreferrer");
    }

    return (
        <div className="book-card">
            <button
                className="book-cover-container book-cover-link"
                onClick={handleCoverClick}
                title="Open book page"
            >
                {book.coverUrl ? (
                    <img
                        className="book-cover"
                        src={book.coverUrl}
                        alt={book.title}
                    />
                ) : (
                    <div className="book-cover-fallback">
                        <BookIcon size={18} />
                    </div>
                )}
            </button>

            <div className="book-details">
                <div className="book-info-text">
                    <div className="book-title-row">
                        <button
                            className={`star-btn ${starred ? "active" : ""}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (canEdit) toggleStarred(book);
                            }}
                            disabled={!canEdit}
                            title={starred ? "Unstar" : "Star"}
                        >
                            <StarIcon filled={starred} />
                        </button>
                        <span className="book-title" title={book.title}>
                            {book.title}
                        </span>
                        <div className="book-tags">
                            <button
                                className={`tag-btn ${book.reading ? "active-reading" : ""}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (canEdit) toggleReading(book);
                                }}
                                disabled={!canEdit}
                                title={
                                    book.reading ? "Reading" : "Mark as reading"
                                }
                            >
                                <ReadingIcon />
                            </button>
                            <button
                                className={`tag-btn ${book.aua ? "active-aua" : ""}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (canEdit) toggleAua(book);
                                }}
                                disabled={!canEdit}
                                title="AUA library"
                            >
                                <span>AUA</span>
                            </button>
                            <button
                                className={`tag-btn ${book.inBookstore ? "active-shop" : ""}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (canEdit) toggleBookstore(book);
                                }}
                                disabled={!canEdit}
                                title={
                                    book.inBookstore
                                        ? "In bookstore"
                                        : "Mark in bookstore"
                                }
                            >
                                <span>
                                    {book.inBookstore &&
                                    book.bookstorePrice != null
                                        ? `$${book.bookstorePrice}`
                                        : "Shop"}
                                </span>
                            </button>
                        </div>
                    </div>
                    <span className="book-author" title={book.author}>
                        {book.author || "Unknown Author"}
                    </span>
                    {book.description && (
                        <span
                            className="book-description"
                            title={book.description}
                        >
                            {book.description}
                        </span>
                    )}
                </div>

                <div className="book-actions">
                    <button
                        className={`action-pill ${book.available ? "active" : ""}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (canEdit) toggleAvailable(book);
                        }}
                        disabled={!canEdit}
                    >
                        Available
                    </button>
                    <button
                        className={`action-pill ${book.narrative ? "active" : ""}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (canEdit) toggleNarrative(book);
                        }}
                        disabled={!canEdit}
                    >
                        Narrative
                    </button>
                </div>
            </div>

            {canEdit && (
                <button
                    className="btn-delete"
                    onClick={(e) => {
                        e.stopPropagation();
                        deleteBook(book.id);
                    }}
                    title="Delete"
                >
                    <DeleteIcon />
                </button>
            )}
        </div>
    );
}

// ── Preview row ──────────────────────────────────────────────
function PreviewBook({ book }) {
    return (
        <div className="preview-book">
            <a
                className="preview-cover preview-cover-link"
                href={bookUrl(book)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
            >
                {book.coverUrl ? (
                    <img src={book.coverUrl} alt={book.title} />
                ) : (
                    <div className="preview-cover-fallback">
                        <BookIcon size={12} opacity={0.4} />
                    </div>
                )}
            </a>
            <div className="preview-info">
                <span className="preview-title">{book.title}</span>
                <span className="preview-author">
                    {book.author || "Unknown Author"}
                </span>
                <div className="preview-badges">
                    {isStarred(book) && (
                        <span className="star-indicator">★</span>
                    )}
                    {book.reading && (
                        <span className="reading-dot" title="Reading" />
                    )}
                    {book.inBookstore && book.bookstorePrice != null && (
                        <span className="shop-indicator">
                            ${book.bookstorePrice}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Modal ────────────────────────────────────────────────────
function QuadrantModal({
    col,
    books,
    canEdit,
    onClose,
    onRequestAuth,
    toggleAvailable,
    toggleNarrative,
    toggleReading,
    toggleAua,
    toggleStarred,
    toggleBookstore,
    unstarAll,
    deleteBook,
}) {
    const [search, setSearch] = useState("");
    const backdropRef = useRef(null);
    const starredCount = books.filter(isStarred).length;

    function handleBackdropClick(e) {
        if (e.target === backdropRef.current) onClose();
    }

    useEffect(() => {
        function handleKey(e) {
            if (e.key === "Escape") onClose();
        }
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [onClose]);

    useScrollLock(true);

    const filtered = books.filter((b) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
            (b.title || "").toLowerCase().includes(q) ||
            (b.author || "").toLowerCase().includes(q)
        );
    });

    function guard(fn) {
        return (...args) => {
            if (!canEdit) {
                onRequestAuth();
                return;
            }
            fn(...args);
        };
    }

    return (
        <div
            className="modal-backdrop"
            ref={backdropRef}
            onClick={handleBackdropClick}
        >
            <div className="modal-sheet">
                <div className="modal-header">
                    <span className="modal-title">
                        {col.title} ({books.length})
                    </span>
                    <div className="modal-header-actions">
                        {starredCount > 0 && (
                            <button
                                className="unstar-all-btn"
                                onClick={guard(unstarAll)}
                            >
                                Unstar all
                            </button>
                        )}
                        <button className="modal-close" onClick={onClose}>
                            <CloseIcon />
                        </button>
                    </div>
                </div>
                <div className="modal-search">
                    <input
                        className="modal-search-input"
                        placeholder="Filter books..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="modal-body">
                    {filtered.length === 0 ? (
                        <div className="modal-empty">
                            {search
                                ? "No matches"
                                : "No books in this quadrant"}
                        </div>
                    ) : (
                        filtered.map((book) => (
                            <BookCard
                                key={book.id}
                                book={book}
                                canEdit={canEdit}
                                toggleAvailable={guard(toggleAvailable)}
                                toggleNarrative={guard(toggleNarrative)}
                                toggleReading={guard(toggleReading)}
                                toggleAua={guard(toggleAua)}
                                toggleStarred={guard(toggleStarred)}
                                toggleBookstore={guard(toggleBookstore)}
                                deleteBook={guard(deleteBook)}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Main App ─────────────────────────────────────────────────
export default function App() {
    const [books, setBooks] = useState([]);
    const [user, setUser] = useState(undefined); // undefined = loading
    const [showAuth, setShowAuth] = useState(false);
    const [title, setTitle] = useState("");
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [openQuadrant, setOpenQuadrant] = useState(null);

    const dropdownRef = useRef(null);
    const canEdit = !!user;

    useEffect(() => {
        return onAuthStateChanged(auth, setUser);
    }, []);

    useEffect(() => {
        function handleClickOutside(event) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        return onSnapshot(collection(db, "books"), (snap) => {
            setBooks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
    }, []);

    useEffect(() => {
        const query = title.trim();
        if (query.length < 2) {
            setSuggestions([]);
            setIsSearching(false);
            return;
        }

        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const params = new URLSearchParams({
                    q: query,
                    limit: "5",
                    fields: "title,author_name,cover_i,key",
                });
                const res = await fetch(
                    `https://openlibrary.org/search.json?${params}`,
                    { signal: controller.signal },
                );
                const data = await res.json();
                const results = (data.docs || []).map((d) => ({
                    title: d.title || "",
                    author: d.author_name
                        ? d.author_name.join(", ")
                        : "Unknown Author",
                    coverUrl: d.cover_i
                        ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`
                        : "",
                    description: "",
                    openLibraryUrl: d.key
                        ? `https://openlibrary.org${d.key}`
                        : "",
                }));
                setSuggestions(results);
                setShowSuggestions(results.length > 0);
            } catch (err) {
                if (err.name !== "AbortError")
                    console.error("Open Library search failed:", err);
            } finally {
                if (!controller.signal.aborted) setIsSearching(false);
            }
        }, 20);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [title]);

    const requestAuth = useCallback(() => setShowAuth(true), []);

    async function handleSelectSuggestion(s) {
        if (!canEdit) {
            requestAuth();
            return;
        }
        await addDoc(collection(db, "books"), {
            title: s.title,
            author: s.author,
            coverUrl: s.coverUrl,
            description: s.description || "",
            openLibraryUrl: s.openLibraryUrl || "",
            available: true,
            narrative: true,
            reading: false,
            aua: false,
            starred: false,
            inBookstore: false,
            bookstorePrice: null,
            createdAt: new Date().toISOString(),
        });
        setTitle("");
        setSuggestions([]);
        setShowSuggestions(false);
    }

    async function handleKeyDown(e) {
        if (e.key === "Enter" && title.trim()) {
            if (!canEdit) {
                requestAuth();
                return;
            }
            await addDoc(collection(db, "books"), {
                title: title.trim(),
                author: "Unknown Author",
                coverUrl: "",
                description: "",
                openLibraryUrl: "",
                available: true,
                narrative: true,
                reading: false,
                aua: false,
                starred: false,
                inBookstore: false,
                bookstorePrice: null,
                createdAt: new Date().toISOString(),
            });
            setTitle("");
            setSuggestions([]);
            setShowSuggestions(false);
        }
    }

    async function toggleAvailable(book) {
        await updateDoc(doc(db, "books", book.id), {
            available: !book.available,
        });
    }
    async function toggleNarrative(book) {
        await updateDoc(doc(db, "books", book.id), {
            narrative: !book.narrative,
        });
    }
    async function toggleReading(book) {
        await updateDoc(doc(db, "books", book.id), { reading: !book.reading });
    }
    async function toggleAua(book) {
        await updateDoc(doc(db, "books", book.id), { aua: !book.aua });
    }
    async function toggleStarred(book) {
        const next = !isStarred(book);
        await updateDoc(doc(db, "books", book.id), {
            starred: next,
            top3: next,
        });
    }
    async function toggleBookstore(book) {
        if (book.inBookstore) {
            await updateDoc(doc(db, "books", book.id), {
                inBookstore: false,
                bookstorePrice: null,
            });
            return;
        }
        const input = prompt("Bookstore price?", book.bookstorePrice ?? "");
        if (input === null) return;
        const price = parseFloat(input);
        if (isNaN(price) || price < 0) return;
        await updateDoc(doc(db, "books", book.id), {
            inBookstore: true,
            bookstorePrice: price,
        });
    }
    async function unstarAll() {
        const starred = books.filter(
            (b) =>
                b.available === openQuadrant.available &&
                b.narrative === openQuadrant.narrative &&
                isStarred(b),
        );
        if (starred.length === 0) return;
        const batch = writeBatch(db);
        starred.forEach((b) =>
            batch.update(doc(db, "books", b.id), {
                starred: false,
                top3: false,
            }),
        );
        await batch.commit();
    }
    async function deleteBook(id) {
        if (confirm("Delete this book?")) await deleteDoc(doc(db, "books", id));
    }

    const totalBooks = books.length;
    const availableCount = books.filter((b) => b.available).length;
    const unavailableCount = totalBooks - availableCount;

    function getPreviewBooks(filteredBooks) {
        const reading = filteredBooks.filter((b) => b.reading);
        const starred = filteredBooks.filter((b) => isStarred(b) && !b.reading);
        const preview = [...reading, ...starred].slice(0, 4);
        if (preview.length < 4) {
            const previewIds = new Set(preview.map((b) => b.id));
            const rest = filteredBooks.filter((b) => !previewIds.has(b.id));
            preview.push(...rest.slice(0, 4 - preview.length));
        }
        return preview;
    }

    return (
        <div className="container">
            <header>
                <div className="brand-section">
                    <h1>TBR Grid</h1>
                    <p>Track your reading queue cleanly</p>
                </div>
                <div className="header-right">
                    <div className="stats-inline">
                        <span>{totalBooks}</span>{" "}
                        {totalBooks === 1 ? "Book" : "Books"}
                        <span className="stats-separator">·</span>
                        <span>{availableCount}</span> Available
                        <span className="stats-separator">·</span>
                        <span>{unavailableCount}</span> Unavailable
                    </div>
                    {user === undefined ? null : canEdit ? (
                        <button
                            className="auth-status"
                            onClick={() => signOut(auth)}
                        >
                            Locked in
                        </button>
                    ) : (
                        <button
                            className="auth-status auth-unlocked"
                            onClick={() => setShowAuth(true)}
                        >
                            Edit
                        </button>
                    )}
                </div>
            </header>

            <div className="form-card">
                <div className="input-wrapper" ref={dropdownRef}>
                    <input
                        className="form-input"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={
                            canEdit
                                ? "Search for a book to add, or type and press Enter..."
                                : "Unlock to add books..."
                        }
                        onFocus={() => {
                            if (!canEdit) requestAuth();
                            else if (suggestions.length > 0)
                                setShowSuggestions(true);
                        }}
                        readOnly={!canEdit}
                    />
                    {isSearching && (
                        <div className="input-spinner">
                            <SpinnerIcon />
                        </div>
                    )}
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="suggestions-dropdown">
                            {suggestions.map((s, idx) => (
                                <div
                                    key={idx}
                                    className="suggestion-item"
                                    onClick={() => handleSelectSuggestion(s)}
                                >
                                    {s.coverUrl ? (
                                        <img
                                            className="suggestion-cover"
                                            src={s.coverUrl}
                                            alt={s.title}
                                        />
                                    ) : (
                                        <div className="suggestion-cover-placeholder">
                                            <BookIcon size={12} opacity={0.5} />
                                        </div>
                                    )}
                                    <div className="suggestion-info">
                                        <span className="suggestion-title">
                                            {s.title}
                                        </span>
                                        <span className="suggestion-author">
                                            {s.author}
                                        </span>
                                        {s.description && (
                                            <span className="suggestion-desc">
                                                {s.description}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="tbr-grid">
                {cols.map((col) => {
                    const filteredBooks = books.filter(
                        (b) =>
                            b.available === col.available &&
                            b.narrative === col.narrative,
                    );
                    const previewBooks = getPreviewBooks(filteredBooks);
                    const remaining =
                        filteredBooks.length - previewBooks.length;

                    return (
                        <div
                            key={col.id}
                            className="quadrant"
                            onClick={() => setOpenQuadrant(col)}
                        >
                            <div className="quadrant-header">
                                <span className="quadrant-title">
                                    {col.title}
                                </span>
                                <span className="quadrant-badge">
                                    {filteredBooks.length}
                                </span>
                            </div>
                            <div className="quadrant-books">
                                {filteredBooks.length === 0 ? (
                                    <div className="empty-state">
                                        <p>Empty</p>
                                    </div>
                                ) : (
                                    <>
                                        {previewBooks.map((book) => (
                                            <PreviewBook
                                                key={book.id}
                                                book={book}
                                            />
                                        ))}
                                        {remaining > 0 && (
                                            <div className="view-all-link">
                                                +{remaining} more
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {openQuadrant && (
                <QuadrantModal
                    col={openQuadrant}
                    books={books.filter(
                        (b) =>
                            b.available === openQuadrant.available &&
                            b.narrative === openQuadrant.narrative,
                    )}
                    canEdit={canEdit}
                    onClose={() => setOpenQuadrant(null)}
                    onRequestAuth={requestAuth}
                    toggleAvailable={toggleAvailable}
                    toggleNarrative={toggleNarrative}
                    toggleReading={toggleReading}
                    toggleAua={toggleAua}
                    toggleStarred={toggleStarred}
                    toggleBookstore={toggleBookstore}
                    unstarAll={unstarAll}
                    deleteBook={deleteBook}
                />
            )}

            {showAuth && (
                <AuthGate
                    onClose={() => setShowAuth(false)}
                    onSuccess={() => setShowAuth(false)}
                />
            )}
        </div>
    );
}
