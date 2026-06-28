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

// Initialize Firebase cleanly
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const cols = [
    {
        id: "narrative-available",
        title: "Narrative / Available",
        available: true,
        narrative: true,
        colorClass: "narrative-available"
    },
    {
        id: "non-narrative-available",
        title: "Non-Narrative / Available",
        available: true,
        narrative: false,
        colorClass: "non-narrative-available"
    },
    {
        id: "narrative-unavailable",
        title: "Narrative / Unavailable",
        available: false,
        narrative: true,
        colorClass: "narrative-unavailable"
    },
    {
        id: "non-narrative-unavailable",
        title: "Non-Narrative / Unavailable",
        available: false,
        narrative: false,
        colorClass: "non-narrative-unavailable"
    },
];

export default function App() {
    const [books, setBooks] = useState([]);
    const [title, setTitle] = useState("");
    
    // Suggestion states
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    
    const dropdownRef = useRef(null);

    // Listen to click outside to close suggestions dropdown
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Listen to books collection in real time
    useEffect(() => {
        return onSnapshot(collection(db, "books"), (snap) => {
            setBooks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
    }, []);

    // Debounced search for books cover/details using Open Library API directly
    useEffect(() => {
        if (!title.trim() || title.length < 3) {
            setSuggestions([]);
            return;
        }

        // If the title matches a selected book's title, don't search
        const isAlreadySelected = suggestions.some(s => s.title === title);
        if (isAlreadySelected) return;

        const delayDebounceFn = setTimeout(async () => {
            setIsSearching(true);
            let results = [];
            
            try {
                const res = await fetch(
                    `https://openlibrary.org/search.json?q=${encodeURIComponent(title)}&limit=5`
                );
                const data = await res.json();
                if (data.docs) {
                    results = data.docs.map((doc) => {
                        const coverUrl = doc.cover_i 
                            ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` 
                            : "";
                        return {
                            title: doc.title || "",
                            author: doc.author_name ? doc.author_name.join(", ") : "Unknown Author",
                            coverUrl: coverUrl,
                        };
                    });
                }
            } catch (err) {
                console.error("Open Library search failed:", err);
            }

            setSuggestions(results);
            setShowSuggestions(results.length > 0);
            setIsSearching(false);
        }, 500); // 500ms debounce to be gentle on Open Library

        return () => clearTimeout(delayDebounceFn);
    }, [title]);

    // Add a book immediately from search selection
    async function handleSelectSuggestion(bookSuggestion) {
        await addDoc(collection(db, "books"), {
            title: bookSuggestion.title,
            author: bookSuggestion.author,
            coverUrl: bookSuggestion.coverUrl,
            available: true,   // default to Available
            narrative: true,   // default to Narrative
            reading: false,    // default to not Reading
            aua: false,        // default to not AUA
            createdAt: new Date().toISOString()
        });
        setTitle("");
        setSuggestions([]);
        setShowSuggestions(false);
    }

    // Add custom title on Enter press
    async function handleKeyDown(e) {
        if (e.key === "Enter" && title.trim()) {
            await addDoc(collection(db, "books"), {
                title: title.trim(),
                author: "Unknown Author",
                coverUrl: "",
                available: true,   // default to Available
                narrative: true,   // default to Narrative
                reading: false,    // default to not Reading
                aua: false,        // default to not AUA
                createdAt: new Date().toISOString()
            });
            setTitle("");
            setSuggestions([]);
            setShowSuggestions(false);
        }
    }

    // Toggle book properties
    async function toggleAvailable(book) {
        const bookRef = doc(db, "books", book.id);
        await updateDoc(bookRef, {
            available: !book.available
        });
    }

    async function toggleNarrative(book) {
        const bookRef = doc(db, "books", book.id);
        await updateDoc(bookRef, {
            narrative: !book.narrative
        });
    }

    async function toggleReading(book) {
        const bookRef = doc(db, "books", book.id);
        await updateDoc(bookRef, {
            reading: !book.reading
        });
    }

    async function toggleAua(book) {
        const bookRef = doc(db, "books", book.id);
        await updateDoc(bookRef, {
            aua: !book.aua
        });
    }

    // Delete a book
    async function deleteBook(id) {
        if (confirm("Are you sure you want to delete this book?")) {
            await deleteDoc(doc(db, "books", id));
        }
    }

    // Count helpers
    const totalBooks = books.length;
    const availableCount = books.filter(b => b.available).length;
    const unavailableCount = totalBooks - availableCount;

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

            {/* Book Add Panel */}
            <div className="form-card">
                <div className="input-wrapper" ref={dropdownRef}>
                    <input
                        className="form-input"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search for a book to add, or type and press Enter..."
                        onFocus={() => {
                            if (suggestions.length > 0) setShowSuggestions(true);
                        }}
                    />
                    {isSearching && (
                        <div style={{ position: "absolute", right: "16px", top: "14px" }}>
                            <svg className="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="12" y1="2" x2="12" y2="6"></line>
                                <line x1="12" y1="18" x2="12" y2="22"></line>
                                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                                <line x1="2" y1="12" x2="6" y2="12"></line>
                                <line x1="18" y1="12" x2="22" y2="12"></line>
                                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                            </svg>
                            <style dangerouslySetInnerHTML={{__html: `
                                @keyframes spin { 100% { transform:rotate(360deg); } }
                                .spin { animation: spin 1s linear infinite; }
                            `}} />
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
                                        <img className="suggestion-cover" src={s.coverUrl} alt={s.title} />
                                    ) : (
                                        <div className="suggestion-cover-placeholder">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                                            </svg>
                                        </div>
                                    )}
                                    <div className="suggestion-info">
                                        <span className="suggestion-title">{s.title}</span>
                                        <span className="suggestion-author">{s.author}</span>
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

                    return (
                        <div key={col.id} className={`quadrant ${col.colorClass}`}>
                            <div className="quadrant-header">
                                <span className="quadrant-title">{col.title}</span>
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
                                    filteredBooks.map((book) => (
                                        <div key={book.id} className="book-card">
                                            <div className="book-cover-container">
                                                {book.coverUrl ? (
                                                    <img className="book-cover" src={book.coverUrl} alt={book.title} />
                                                ) : (
                                                    <div className="book-cover-fallback">
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.3 }}>
                                                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                                                        </svg>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="book-details">
                                                <div className="book-info-text">
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                        <span className="book-title" title={book.title}>{book.title}</span>
                                                        
                                                        <div className="book-tags">
                                                            <button 
                                                                className={`tag-btn ${book.reading ? "active-reading" : ""}`}
                                                                onClick={() => toggleReading(book)}
                                                                title={book.reading ? "Reading right now" : "Mark as Reading"}
                                                            >
                                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                                                                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                                                                </svg>
                                                            </button>
                                                            <button 
                                                                className={`tag-btn ${book.aua ? "active-aua" : ""}`}
                                                                onClick={() => toggleAua(book)}
                                                                title={book.aua ? "Available at AUA" : "Mark as available at AUA"}
                                                            >
                                                                <span>AUA</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <span className="book-author" title={book.author}>{book.author || "Unknown Author"}</span>
                                                </div>

                                                <div className="book-actions">
                                                    <button 
                                                        className={`action-pill ${book.available ? "active" : ""}`}
                                                        onClick={() => toggleAvailable(book)}
                                                    >
                                                        Available
                                                    </button>
                                                    <button 
                                                        className={`action-pill ${book.narrative ? "active" : ""}`}
                                                        onClick={() => toggleNarrative(book)}
                                                    >
                                                        Narrative
                                                    </button>
                                                </div>
                                            </div>

                                            <button 
                                                className="btn-delete" 
                                                onClick={() => deleteBook(book.id)}
                                                title="Delete Book"
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                                </svg>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
