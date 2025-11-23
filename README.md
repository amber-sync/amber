# Amber

<div align="center">
  <img src="public/logo.svg" alt="Amber Logo" width="120" height="120" style="filter: hue-rotate(-25deg) brightness(1.2) saturate(2);">  
  <h1 style="margin-top: 20px;">Amber Backup</h1>
  <p><strong>Professional, Time Machine-style backups for any server.</strong></p>

  <p>
    <a href="#features">Features</a> •
    <a href="#installation">Installation</a> •
    <a href="#usage">Usage</a> •
    <a href="#development">Development</a>
  </p>
</div>

---

**Amber** is a modern, native macOS application that brings the power of enterprise-grade `rsync` backups to a beautiful, user-friendly interface. It allows you to create incremental, Time Machine-style snapshots of your remote servers or local directories, saving massive amounts of disk space while keeping every historical version of your files accessible.

## ✨ Features

*   **🕰 Time Machine Mode**: Creates versioned snapshots using hard links (`--link-dest`). Only changed files take up space; unchanged files are instant and "free" on disk.
*   **🔁 Smart Rotation**: Automatically prunes old backups using a "1:1 30:7 365:30" strategy (keep dailies for a month, weeklies for a year).
*   **🚀 Native Performance**: Built on Electron and `rsync`, leveraging the raw speed of your system's native tools.
*   **🖥 Beautiful UI**: A clean, dark-mode ready interface built with React and Tailwind CSS.
*   **🔐 Secure SSH**: Seamlessly handles SSH keys and configurations for remote server backups.
*   **📂 Snapshot Browser**: Browse historical file versions directly within the app without touching the terminal.
*   **⚡ Live Terminal**: Watch the raw `rsync` output in real-time as your backup progresses.

## 🛠 Architecture

Amber bridges the gap between web technologies and system utilities:

*   **Frontend**: React, Tailwind CSS, Recharts (for storage visualization).
*   **Backend**: Electron (Node.js) handling the `spawn` of native processes.
*   **Core Engine**: `rsync` for data transfer and `fs` for snapshot management.

## 📦 Installation

### For Users
*(Coming Soon: Downloadable `.dmg` releases will be available in the Releases tab)*

### For Developers

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/florianmahner/amber.git
    cd amber
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Start the app (Development Mode)**:
    ```bash
    npm run electron:dev
    ```
    This launches the React dev server (Vite) and the Electron container simultaneously with hot-reload.

## 🖥 Usage

1.  **Create a Job**: Click "New Job" and define your Source (e.g., `user@myserver.com:/var/www`) and Destination (e.g., `/Volumes/Backups/MySite`).
2.  **Choose Strategy**:
    *   **Mirror**: Exact replica. Good for simple syncs.
    *   **Time Machine**: The magic mode. Keeps history.
3.  **Run**: Click "Sync Now". Amber will connect, transfer only changed blocks, and link unchanged files to the previous snapshot.
4.  **Browse**: Click the "Eye" icon on any snapshot to explore the file system as it existed at that moment.

## 🧪 Testing

Amber includes a "heavy" integration test suite that validates the backup logic in a real sandbox environment without risking your data.

```bash
npm test
```

This verifies:
*   Correct flag generation (`-a`, `-z`, `--delete`, etc.)
*   Real file creation and modification.
*   **Hard link verification**: Ensures unchanged files share inodes (saving space).
*   **Expiry logic**: Confirms old backups are deleted according to the schedule.

## 📝 License

MIT © Florian P. Mahner
