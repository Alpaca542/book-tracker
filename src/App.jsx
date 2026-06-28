import React, { useEffect, useState, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
    getFirestore,
    collection,
    addDoc,
    deleteDoc,
    doc,
    updateDoc,
    onSnapshot,
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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const cols = [
    { id: "narrative-available", title: "Narrative / Available", available: true, narrative: true },
    { id: "non-narrative-available", title: "Non-Narrative / Available", available: true, narrative: false },
    { id: "narrative-unavailable", title: "Narrative / Unavailable", available: false, narrative: true },
    { id: "non-narrative-unavailable", title: "Non-Narrative / Unavailable", available: false, narrative: false },
];

// ── Tiny SVG icons as components ─────────────────────────────
function BookIcon({ size = 14, opacity = 0.3 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity }}>
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
    );
}

function StarIcon({ filled }) {
    return filled ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    );
}

function ReadingIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
    );
}

function CloseIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    );
}

function DeleteIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    );
}

function SpinnerIcon() {
    return (
        <svg className="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" />
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
            <line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" />
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
        </svg>
    );
}

// ── Book Card (full controls, used inside modal) ─────────────
function BookCard({ book, toggleAvailable, toggleNarrative, toggleReading, toggleAua, toggleTop3, deleteBook }) {
    return (
        <div className="book-card">
            <div className="book-cover-container">
                {book.coverUrl ? (
                    <img className="book-cover" src={book.coverUrl} alt={book.title} />
                ) : (
                    <div className="book-cover-fallback"><BookIcon size={18} /></div>
                )}
            </div>

            <div className="book-details">
                <div className="book-info-text">
                    <div className="book-title-row">
                        <button
                            className={`star-btn ${book.top3 ? "active" : ""}`}
                            onClick={(e) => { e.stopPropagation(); toggleTop3(book); }}
                            title={book.top3 ? "Remove from Top 3" : "Mark as Top 3"}
                        >
                            <StarIcon filled={book.top3} />
                        </button>
                        <span className="book-title" title={book.title}>{book.title}</span>
                        <div className="book-tags">
                            <button
                                className={`tag-btn ${book.reading ? "active-reading" : ""}`}
                                onClick={(e) => { e.stopPropagation(); toggleReading(book); }}
                                title={book.reading ? "Reading right now" : "Mark as Reading"}
                            >
                                <ReadingIcon />
                            </button>
                            <button
                                className={`tag-btn ${book.aua ? "active-aua" : ""}`}
                                onClick={(e) => { e.stopPropagation(); toggleAua(book); }}
                                title={book.aua ? "Available at AUA" : "Mark as available at AUA"}
                            >
                                <span>AUA</span>
                            </button>
                        </div>
                    </div>
                    <span className="book-author" title={book.author}>{book.author || "Unknown Author"}</span>
                    {book.description && (
                        <span className="book-description" title={book.description}>{book.description}</span>
                    )}
                </div>

                <div className="book-actions">
                    <button className={`action-pill ${book.available ? "active" : ""}`} onClick={(e) => { e.stopPropagation(); toggleAvailable(book); }}>
                        Available
                    </button>
                    <button className={`action-pill ${book.narrative ? "active" : ""}`} onClick={(e) => { e.stopPropagation(); toggleNarrative(book); }}>
                        Narrative
                    </button>
                </div>
            </div>

            <button className="btn-delete" onClick={(e) => { e.stopPropagation(); deleteBook(book.id); }} title="Delete Book">
                <DeleteIcon />
            </button>
        </div>
    );
}

// ── Preview row (compact, used on the collapsed quadrant) ────
function PreviewBook({ book }) {
    return (
        <div className="preview-book">
            <div className="preview-cover">
                {book.coverUrl ? (
                    <img src={book.coverUrl} alt={book.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                    <div className="preview-cover-fallback"><BookIcon size={12} opacity={0.4} /></div>
                )}
            </div>
            <div className="preview-info">
                <span className="preview-title">{book.title}</span>
                <span className="preview-author">{book.author || "Unknown Author"}</span>
                <div className="preview-badges">
                    {book.top3 && <span className="star-indicator">★</span>}
                    {book.reading && <span className="reading-dot" title="Reading" />}
                </div>
            </div>
        </div>
    );
}

// ── Modal ────────────────────────────────────────────────────
function QuadrantModal({ col, books, onClose, toggleAvailable, toggleNarrative, toggleReading, toggleAua, toggleTop3, deleteBook }) {
    const [search, setSearch] = useState("");
    const backdropRef = useRef(null);

    // Close on backdrop click
    function handleBackdropClick(e) {
        if (e.target === backdropRef.current) onClose();
    }

    // Close on Escape key
    useEffect(() => {
        function handleKey(e) { if (e.key === "Escape") onClose(); }
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [onClose]);

    // Prevent body scroll while modal is open
    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = ""; };
    }, []);

    const filtered = books.filter(b => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (b.title || "").toLowerCase().includes(q) || (b.author || "").toLowerCase().includes(q);
    });

    return (
        <div className="modal-backdrop" ref={backdropRef} onClick={handleBackdropClick}>
            <div className="modal-sheet">
                <div className="modal-header">
                    <span className="modal-title">{col.title} ({books.length})</span>
                    <button className="modal-close" onClick={onClose}><CloseIcon /></button>
                </div>
                <div className="modal-search">
                    <input
                        className="modal-search-input"
                        placeholder="Filter books..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                    />
                </div>
                <div className="modal-body">
                    {filtered.length === 0 ? (
                        <div className="modal-empty">{search ? "No matches" : "No books in this quadrant"}</div>
                    ) : (
                        filtered.map((book) => (
                            <BookCard
                                key={book.id}
                                book={book}
                                toggleAvailable={toggleAvailable}
                                toggleNarrative={toggleNarrative}
                                toggleReading={toggleReading}
                                toggleAua={toggleAua}
                                toggleTop3={toggleTop3}
                                deleteBook={deleteBook}
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
    const [title, setTitle] = useState("");
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [openQuadrant, setOpenQuadrant] = useState(null); // which quadrant modal is open

    const dropdownRef = useRef(null);

    // Click outside to close suggestions
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Firestore real-time listener
    useEffect(() => {
        return onSnapshot(collection(db, "books"), (snap) => {
            setBooks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
    }, []);

    // Debounced Open Library search (now also fetches description)
    useEffect(() => {
        if (!title.trim() || title.length < 3) { setSuggestions([]); return; }
        const isAlreadySelected = suggestions.some(s => s.title === title);
        if (isAlreadySelected) return;

        const timer = setTimeout(async () => {
            setIsSearching(true);
            let results = [];
            try {
                const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(title)}&limit=5&fields=title,author_name,cover_i,first_sentence,first_publish_year,subject`);
                const data = await res.json();
                if (data.docs) {
                    results = data.docs.map((d) => {
                        const coverUrl = d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : "";
                        // Build a brief description
                        let desc = "";
                        if (d.first_sentence && d.first_sentence.length > 0) {
                            // first_sentence can be a string or array
                            const raw = Array.isArray(d.first_sentence) ? d.first_sentence[0] : d.first_sentence;
                            desc = typeof raw === "string" ? raw : "";
                        }
                        if (!desc && d.subject && d.subject.length > 0) {
                            const yr = d.first_publish_year ? `${d.first_publish_year} · ` : "";
                            desc = yr + d.subject.slice(0, 3).join(", ");
                        }
                        if (!desc && d.first_publish_year) {
                            desc = `First published ${d.first_publish_year}`;
                        }
                        // Truncate to ~100 chars
                        if (desc.length > 100) desc = desc.slice(0, 97) + "...";
                        return {
                            title: d.title || "",
                            author: d.author_name ? d.author_name.join(", ") : "Unknown Author",
                            coverUrl,
                            description: desc,
                        };
                    });
                }
            } catch (err) { console.error("Open Library search failed:", err); }
            setSuggestions(results);
            setShowSuggestions(results.length > 0);
            setIsSearching(false);
        }, 500);
        return () => clearTimeout(timer);
    }, [title]);

    // Add book from suggestion click
    async function handleSelectSuggestion(s) {
        await addDoc(collection(db, "books"), {
            title: s.title,
            author: s.author,
            coverUrl: s.coverUrl,
            description: s.description || "",
            available: true,
            narrative: true,
            reading: false,
            aua: false,
            top3: false,
            createdAt: new Date().toISOString(),
        });
        setTitle("");
        setSuggestions([]);
        setShowSuggestions(false);
    }

    // Add custom title on Enter
    async function handleKeyDown(e) {
        if (e.key === "Enter" && title.trim()) {
            await addDoc(collection(db, "books"), {
                title: title.trim(),
                author: "Unknown Author",
                coverUrl: "",
                description: "",
                available: true,
                narrative: true,
                reading: false,
                aua: false,
                top3: false,
                createdAt: new Date().toISOString(),
            });
            setTitle("");
            setSuggestions([]);
            setShowSuggestions(false);
        }
    }

    // Toggle functions
    async function toggleAvailable(book) {
        await updateDoc(doc(db, "books", book.id), { available: !book.available });
    }
    async function toggleNarrative(book) {
        await updateDoc(doc(db, "books", book.id), { narrative: !book.narrative });
    }
    async function toggleReading(book) {
        await updateDoc(doc(db, "books", book.id), { reading: !book.reading });
    }
    async function toggleAua(book) {
        await updateDoc(doc(db, "books", book.id), { aua: !book.aua });
    }

    // Toggle top3 with max-3-per-quadrant enforcement
    async function toggleTop3(book) {
        if (book.top3) {
            // Simply unmark
            await updateDoc(doc(db, "books", book.id), { top3: false });
        } else {
            // Count current top3 in the same quadrant
            const sameQuadrant = books.filter(
                b => b.available === book.available && b.narrative === book.narrative && b.top3
            );
            if (sameQuadrant.length >= 3) {
                // Unmark the oldest one (by createdAt)
                const oldest = sameQuadrant.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""))[0];
                if (oldest) await updateDoc(doc(db, "books", oldest.id), { top3: false });
            }
            await updateDoc(doc(db, "books", book.id), { top3: true });
        }
    }

    async function deleteBook(id) {
        if (confirm("Delete this book?")) {
            await deleteDoc(doc(db, "books", id));
        }
    }

    // Helpers
    const totalBooks = books.length;
    const availableCount = books.filter(b => b.available).length;
    const unavailableCount = totalBooks - availableCount;

    // Get the books to preview in a collapsed quadrant
    function getPreviewBooks(filteredBooks) {
        const reading = filteredBooks.filter(b => b.reading);
        const top3 = filteredBooks.filter(b => b.top3 && !b.reading);
        // Show reading books first, then top3, up to 4 total
        const preview = [...reading, ...top3].slice(0, 4);
        // If we have fewer than 4, fill with other books
        if (preview.length < 4) {
            const previewIds = new Set(preview.map(b => b.id));
            const rest = filteredBooks.filter(b => !previewIds.has(b.id));
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
                <div className="stats-inline">
                    <span>{totalBooks}</span> {totalBooks === 1 ? "Book" : "Books"}
                    <span className="stats-separator">·</span>
                    <span>{availableCount}</span> Available
                    <span className="stats-separator">·</span>
                    <span>{unavailableCount}</span> Unavailable
                </div>
            </header>

            {/* Search Input */}
            <div className="form-card">
                <div className="input-wrapper" ref={dropdownRef}>
                    <input
                        className="form-input"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search for a book to add, or type and press Enter..."
                        onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                    />
                    {isSearching && (
                        <div style={{ position: "absolute", right: "16px", top: "14px" }}>
                            <SpinnerIcon />
                        </div>
                    )}
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="suggestions-dropdown">
                            {suggestions.map((s, idx) => (
                                <div key={idx} className="suggestion-item" onClick={() => handleSelectSuggestion(s)}>
                                    {s.coverUrl ? (
                                        <img className="suggestion-cover" src={s.coverUrl} alt={s.title} />
                                    ) : (
                                        <div className="suggestion-cover-placeholder"><BookIcon size={12} opacity={0.5} /></div>
                                    )}
                                    <div className="suggestion-info">
                                        <span className="suggestion-title">{s.title}</span>
                                        <span className="suggestion-author">{s.author}</span>
                                        {s.description && <span className="suggestion-desc">{s.description}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* The 2x2 Grid */}
            <div className="tbr-grid">
                {cols.map((col) => {
                    const filteredBooks = books.filter(
                        (b) => b.available === col.available && b.narrative === col.narrative
                    );
                    const previewBooks = getPreviewBooks(filteredBooks);
                    const remaining = filteredBooks.length - previewBooks.length;

                    return (
                        <div
                            key={col.id}
                            className="quadrant"
                            onClick={() => setOpenQuadrant(col)}
                        >
                            <div className="quadrant-header">
                                <span className="quadrant-title">{col.title}</span>
                                <span className="quadrant-badge">{filteredBooks.length}</span>
                            </div>

                            <div className="quadrant-books">
                                {filteredBooks.length === 0 ? (
                                    <div className="empty-state"><p>Empty</p></div>
                                ) : (
                                    <>
                                        {previewBooks.map((book) => (
                                            <PreviewBook key={book.id} book={book} />
                                        ))}
                                        {remaining > 0 && (
                                            <div className="view-all-link">+{remaining} more</div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal */}
            {openQuadrant && (
                <QuadrantModal
                    col={openQuadrant}
                    books={books.filter(b => b.available === openQuadrant.available && b.narrative === openQuadrant.narrative)}
                    onClose={() => setOpenQuadrant(null)}
                    toggleAvailable={toggleAvailable}
                    toggleNarrative={toggleNarrative}
                    toggleReading={toggleReading}
                    toggleAua={toggleAua}
                    toggleTop3={toggleTop3}
                    deleteBook={deleteBook}
                />
            )}
        </div>
    );
}
