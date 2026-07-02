# TBR Grid

1. `npm install`
2. Create a free Firebase project
3. Enable **Firestore** and **Email/Password** auth
4. Create one auth user (email: `editor@tbrgrid.local`, your password)
5. Deploy Firestore rules: `firebase deploy --only firestore:rules` (or paste `firestore.rules` in the Firebase console)
6. Paste your `firebaseConfig` into `src/App.jsx`
7. `npm run dev`

Books are stored in Firestore — clearing browser cache will not delete them.

## Editing

Click **Edit** in the header and enter your password once. Firebase keeps you signed in. Only authenticated users can write to the database.

## Batch add

Add many books from a text file (one title per line):

```bash
npm run batch-add books.txt
```

Skips titles that already exist. Looks up metadata from Open Library.

## Bookstore

In the modal, click **Shop** on a book to mark it as in a bookstore and set a price. Click again to remove.

## Covers

Click a book cover to open its Open Library or Google Books page.
