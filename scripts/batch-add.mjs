#!/usr/bin/env node
/**
 * Batch-add books from a text file (one title per line).
 * Usage: npm run batch-add [books.txt]
 *
 * Requires Firebase Auth user (same password as the web app).
 * Set VITE_ADMIN_EMAIL in .env or use default editor@tbrgrid.local
 */

import { readFileSync } from "fs";
import { createInterface } from "readline";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs, query, where } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyAkjjrS6GrqmkqQHcma2IiDJk1kP6RBm7o",
    authDomain: "book-tracker-cbf62.firebaseapp.com",
    projectId: "book-tracker-cbf62",
    storageBucket: "book-tracker-cbf62.firebasestorage.app",
    messagingSenderId: "557333582609",
    appId: "1:557333582609:web:133040f540fe867847f2b0",
};

const ADMIN_EMAIL = process.env.VITE_ADMIN_EMAIL || "editor@tbrgrid.local";
const file = process.argv[2] || "books.txt";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function prompt(question) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

async function searchOpenLibrary(title) {
    const res = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(title)}&limit=1&fields=title,author_name,cover_i,first_sentence,first_publish_year,subject,key`
    );
    const data = await res.json();
    const d = data.docs?.[0];
    if (!d) return { title, author: "Unknown Author", coverUrl: "", description: "", openLibraryUrl: "" };

    const coverUrl = d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : "";
    let desc = "";
    if (d.first_sentence?.length > 0) {
        const raw = Array.isArray(d.first_sentence) ? d.first_sentence[0] : d.first_sentence;
        desc = typeof raw === "string" ? raw : "";
    }
    if (!desc && d.subject?.length > 0) {
        const yr = d.first_publish_year ? `${d.first_publish_year} · ` : "";
        desc = yr + d.subject.slice(0, 3).join(", ");
    }
    if (desc.length > 100) desc = desc.slice(0, 97) + "...";

    return {
        title: d.title || title,
        author: d.author_name ? d.author_name.join(", ") : "Unknown Author",
        coverUrl,
        description: desc,
        openLibraryUrl: d.key ? `https://openlibrary.org${d.key}` : "",
    };
}

async function titleExists(title) {
    const q = query(collection(db, "books"), where("title", "==", title));
    const snap = await getDocs(q);
    return !snap.empty;
}

async function main() {
    const lines = readFileSync(file, "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

    if (lines.length === 0) {
        console.log("No titles found in", file);
        process.exit(0);
    }

    const password = await prompt("Password: ");
    await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
    console.log(`Adding ${lines.length} books from ${file}...\n`);

    let added = 0;
    let skipped = 0;

    for (const line of lines) {
        if (await titleExists(line)) {
            console.log(`  skip  ${line} (already exists)`);
            skipped++;
            continue;
        }

        const meta = await searchOpenLibrary(line);
        await addDoc(collection(db, "books"), {
            ...meta,
            available: true,
            narrative: true,
            reading: false,
            aua: false,
            starred: false,
            inBookstore: false,
            bookstorePrice: null,
            createdAt: new Date().toISOString(),
        });
        console.log(`  added ${meta.title} — ${meta.author}`);
        added++;
        await new Promise((r) => setTimeout(r, 300));
    }

    console.log(`\nDone: ${added} added, ${skipped} skipped`);
    process.exit(0);
}

main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
});
