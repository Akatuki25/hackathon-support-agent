import { useCallback, useRef, useEffect } from "react";
import { Node } from "@xyflow/react";
import { patchTask } from "@/libs/modelAPI/task";

interface NodePosition {
  task_id: string;
  position_x: number;
  position_y: number;
}

interface UseNodePositionSyncOptions {
  debounceMs?: number;
}

/**
 * Hook to sync node positions to the backend with debouncing
 *
 * This hook batches position updates and sends them to the API after a delay,
 * preventing excessive API calls during drag operations.
 *
 * @param options - Configuration options
 * @returns Object with queuePositionUpdate and flushPendingUpdates functions
 */
export function useNodePositionSync(options: UseNodePositionSyncOptions = {}) {
  const { debounceMs = 500 } = options;

  // Track pending position updates
  const pendingUpdates = useRef<Map<string, NodePosition>>(new Map());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Flush all pending updates to the API
  const flushPendingUpdates = useCallback(async () => {
    if (pendingUpdates.current.size === 0) return;

    const updates = Array.from(pendingUpdates.current.values());
    pendingUpdates.current.clear();

    // Send all updates in parallel
    const promises = updates.map(async (update) => {
      try {
        await patchTask(update.task_id, {
          position_x: update.position_x,
          position_y: update.position_y,
        });
      } catch (error) {
        console.error(
          `Failed to update position for task ${update.task_id}:`,
          error,
        );
      }
    });

    await Promise.all(promises);
  }, []);

  // Queue a position update (will be batched and debounced)
  const queuePositionUpdate = useCallback(
    (node: Node) => {
      const taskId = node.data?.task_id as string | undefined;
      if (!taskId) {
        console.warn("Node missing task_id, skipping position sync:", node.id);
        return;
      }

      // Add/update in pending map
      pendingUpdates.current.set(taskId, {
        task_id: taskId,
        position_x: Math.round(node.position.x),
        position_y: Math.round(node.position.y),
      });

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout for flush
      timeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          flushPendingUpdates();
        }
      }, debounceMs);
    },
    [debounceMs, flushPendingUpdates],
  );

  // Queue multiple position updates at once
  const queueMultiplePositionUpdates = useCallback(
    (nodes: Node[]) => {
      nodes.forEach((node) => {
        const taskId = node.data?.task_id as string | undefined;
        if (taskId) {
          pendingUpdates.current.set(taskId, {
            task_id: taskId,
            position_x: Math.round(node.position.x),
            position_y: Math.round(node.position.y),
          });
        }
      });

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout for flush
      timeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          flushPendingUpdates();
        }
      }, debounceMs);
    },
    [debounceMs, flushPendingUpdates],
  );

  // Cleanup on unmount - flush any pending updates
  useEffect(() => {
    isMountedRef.current = true;

    // Copy ref values for cleanup function
    const pendingUpdatesRef = pendingUpdates;
    const timeoutRefCurrent = timeoutRef;

    return () => {
      isMountedRef.current = false;

      // Clear timeout
      if (timeoutRefCurrent.current) {
        clearTimeout(timeoutRefCurrent.current);
      }

      // Flush remaining updates synchronously on unmount
      if (pendingUpdatesRef.current.size > 0) {
        const updates = Array.from(pendingUpdatesRef.current.values());
        pendingUpdatesRef.current.clear();

        // Fire and forget - we're unmounting
        updates.forEach((update) => {
          patchTask(update.task_id, {
            position_x: update.position_x,
            position_y: update.position_y,
          }).catch((error) => {
            console.error(
              `Failed to update position for task ${update.task_id}:`,
              error,
            );
          });
        });
      }
    };
  }, []);

  return {
    queuePositionUpdate,
    queueMultiplePositionUpdates,
    flushPendingUpdates,
  };
}
