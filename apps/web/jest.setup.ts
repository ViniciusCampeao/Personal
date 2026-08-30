// Dexie grabs `indexedDB` from the global scope when it loads, so the in-memory
// implementation has to be installed before any module that opens a database.
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// The default 1s is enough on an idle machine but not when the api and web suites run in
// parallel — a slow `findBy*` there is scheduling noise, not a defect. 2.5s still flaked
// under CI/CPU contention, so this leaves more headroom.
configure({ asyncUtilTimeout: 5_000 });
