#!/usr/bin/env node
/**
 * Enrich books that are missing descriptions by asking Open Library for one.
 * Usage:
 *   npm run enrich-descriptions
 *   npm run enrich-descriptions -- --dry-run
 *
 * Requires Firebase Auth user (same password as the web app).
 * Set VITE_ADMIN_EMAIL in .env or use default editor@tbrgrid.local
 */

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
    getFirestore,
    collection,
    getDocs,
    updateDoc,
    doc,
} from "firebase/firestore";
import { createInterface } from "readline";

const firebaseConfig = {
    apiKey: "AIzaSyAkjjrS6GrqmkqQHcma2IiDJk1kP6RBm7o",
    authDomain: "book-tracker-cbf62.firebaseapp.com",
    projectId: "book-tracker-cbf62",
    storageBucket: "book-tracker-cbf62.firebasestorage.app",
    messagingSenderId: "557333582609",
    appId: "1:557333582609:web:133040f540fe867847f2b0",
};

const ADMIN_EMAIL = process.env.VITE_ADMIN_EMAIL || "editor@tbrgrid.local";
const dryRun = process.argv.includes("--dry-run");

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

function truncate(text, max = 160) {
    if (!text) return "";
    return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function buildDescription(d) {
    if (d.first_sentence?.length > 0) {
        const raw = Array.isArray(d.first_sentence)
            ? d.first_sentence[0]
            : d.first_sentence;
        if (typeof raw === "string" && raw.trim()) return truncate(raw.trim());
    }
    if (d.subject?.length > 0) {
        const yr = d.first_publish_year ? `${d.first_publish_year} · ` : "";
        return truncate(`${yr}${d.subject.slice(0, 3).join(", ")}`);
    }
    if (d.first_publish_year) return `First published ${d.first_publish_year}`;
    return "";
}

async function searchOpenLibrary(book) {
    const query = [book.title, book.author].filter(Boolean).join(" ");
    const params = new URLSearchParams({
        q: query,
        limit: "1",
        fields: "title,author_name,cover_i,key,first_sentence,first_publish_year,subject",
    });

    const res = await fetch(
        `https://openlibrary.org/search.json?${params}`,
    );
    const data = await res.json();
    const d = data.docs?.[0];

    if (!d) return { description: "", openLibraryUrl: "", coverUrl: "" };

    return {
        description: buildDescription(d),
        openLibraryUrl: d.key ? `https://openlibrary.org${d.key}` : "",
        coverUrl: d.cover_i
            ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`
            : "",
    };
}

async function main() {
    const password = await prompt("Password: ");
    await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);

    const snapshot = await getDocs(collection(db, "books"));
    const missing = snapshot.docs.filter((item) => {
        const data = item.data();
        return !data.description?.trim();
    });

    console.log(`Found ${missing.length} books without descriptions.`);

    if (dryRun) {
        console.log("Dry run only; no updates were made.");
        process.exit(0);
    }

    let updated = 0;
    for (const item of missing) {
        const data = item.data();
        const meta = await searchOpenLibrary(data);
        if (!meta.description) {
            console.log(`  skip   ${data.title || "Untitled"}`);
            continue;
        }

        await updateDoc(doc(db, "books", item.id), {
            description: meta.description,
            ...(meta.openLibraryUrl ? { openLibraryUrl: meta.openLibraryUrl } : {}),
            ...(meta.coverUrl ? { coverUrl: meta.coverUrl } : {}),
        });
        updated += 1;
        console.log(`  updated ${data.title || "Untitled"}`);
        await new Promise((resolve) => setTimeout(resolve, 250));
    }

    console.log(`Completed. Updated ${updated} book${updated === 1 ? "" : "s"}.`);
}

main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
});
