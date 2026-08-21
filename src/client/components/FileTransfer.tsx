export interface TransferEntry {
  id: string;
  fileName: string;
  fileSize: number;
  progress: number;
  direction: 'sending' | 'receiving';
  targetName?: string;
  targetId?: string;
  senderName?: string;
  senderId?: string;
  status: 'pending' | 'transferring' | 'done' | 'error' | 'cancelled' | 'declined';
  error?: string;
  downloadUrl?: string;
}

interface FileTransferPanelProps {
  transfers: TransferEntry[];
  onCancel: (transferId: string) => void;
  onDelete: (transferId: string) => void;
  onSelectFile: () => void;
  onClose: () => void;
}

export function FileTransferPanel({ transfers, onCancel, onDelete, onSelectFile, onClose }: FileTransferPanelProps) {
  const activeTransfers = transfers.filter(t => t.status === 'transferring' || t.status === 'pending');
  const completedTransfers = transfers.filter(t => t.status === 'done');
  const errorTransfers = transfers.filter(t => t.status === 'error' || t.status === 'cancelled' || t.status === 'declined');

  return (
    <div className="flex flex-col h-full w-72 bg-gray-900 border-l border-gray-800">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <span className="font-semibold text-sm text-gray-200">File Transfers</span>
        <button onClick={onClose} className="text-lg text-gray-400 hover:text-white">&times;</button>
      </div>

      <div className="p-2 border-b border-gray-800">
        <button
          onClick={onSelectFile}
          className="w-full py-2 px-3 rounded-lg text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors"
        >
          Share File with Room
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {transfers.length === 0 && (
          <p className="text-gray-500 text-xs text-center mt-6">
            Click "Share File with Room" to send a file to everyone.
          </p>
        )}

        {activeTransfers.length > 0 && (
          <div>
            <h4 className="text-[10px] font-medium text-gray-500 uppercase mb-2">Active</h4>
            {activeTransfers.map(t => (
              <TransferItem
                key={t.id}
                transfer={t}
                onCancel={onCancel}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}

        {completedTransfers.length > 0 && (
          <div>
            <h4 className="text-[10px] font-medium text-gray-500 uppercase mb-2">Completed</h4>
            {completedTransfers.map(t => (
              <TransferItem
                key={t.id}
                transfer={t}
                onCancel={onCancel}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}

        {errorTransfers.length > 0 && (
          <div>
            <h4 className="text-[10px] font-medium text-gray-500 uppercase mb-2">Failed</h4>
            {errorTransfers.map(t => (
              <TransferItem
                key={t.id}
                transfer={t}
                onCancel={onCancel}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TransferItem({ transfer, onCancel, onDelete }: {
  transfer: TransferEntry;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const statusColor = {
    pending: 'border-gray-600',
    transferring: 'border-blue-600',
    done: 'border-green-600',
    error: 'border-red-600',
    cancelled: 'border-yellow-600',
    declined: 'border-red-600',
  }[transfer.status] || 'border-gray-600';

  return (
    <div className={`bg-gray-800 rounded-lg p-2.5 mb-2 border-l-2 ${statusColor}`}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-white truncate">{transfer.fileName}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {transfer.direction === 'sending'
              ? `To: ${transfer.targetName || 'Everyone'}`
              : `From: ${transfer.senderName || 'Peer'}`
            }
          </p>
        </div>
        <span className="text-[10px] text-gray-500 shrink-0">{formatSize(transfer.fileSize)}</span>
      </div>

      {(transfer.status === 'transferring' || transfer.status === 'pending') && (
        <div className="mb-1.5">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-700 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-200"
                style={{ width: `${transfer.progress}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-500 w-8 text-right">{Math.round(transfer.progress)}%</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-500">
          {transfer.status === 'transferring' && 'Transferring...'}
          {transfer.status === 'pending' && 'Waiting...'}
          {transfer.status === 'done' && 'Completed'}
          {transfer.status === 'error' && (transfer.error || 'Error')}
          {transfer.status === 'cancelled' && 'Cancelled'}
          {transfer.status === 'declined' && 'Declined'}
        </span>
        <div className="flex gap-1.5">
          {transfer.status === 'done' && transfer.downloadUrl && (
            <a
              href={transfer.downloadUrl}
              download={transfer.fileName}
              className="text-[10px] px-2 py-1 bg-green-600/30 hover:bg-green-600/50 text-green-400 rounded transition-colors"
            >
              Save
            </a>
          )}
          {(transfer.status === 'transferring' || transfer.status === 'pending') && (
            <button
              onClick={() => onCancel(transfer.id)}
              className="text-[10px] px-2 py-1 bg-red-600/30 hover:bg-red-600/50 text-red-400 rounded transition-colors"
            >
              Cancel
            </button>
          )}
          {(transfer.status === 'done' || transfer.status === 'cancelled' || transfer.status === 'declined' || transfer.status === 'error') && (
            <button
              onClick={() => onDelete(transfer.id)}
              className="text-[10px] px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-400 rounded transition-colors"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (!bytes || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
