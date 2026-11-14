/** File download shared by JSON backups and readable conversation transcripts. */
function downloadFile(content, mimeType, prefix, extension) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;
  try {
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function downloadBackupFile(backup, prefix = 'wenzhixuan-backup') {
  downloadFile(JSON.stringify(backup, null, 2), 'application/json', prefix, 'json');
}

export function downloadConversationText(text) {
  downloadFile(text, 'text/plain', 'wenzhixuan-conversation', 'txt');
}
