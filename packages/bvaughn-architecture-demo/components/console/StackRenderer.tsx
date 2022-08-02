import Loader from "@bvaughn/components/Loader";
import { getSource } from "@bvaughn/src/suspense/SourcesCache";
import { CallStack, Frame, FrameId } from "@replayio/protocol";
import React, { memo, Suspense, useContext } from "react";
import { ReplayClientContext } from "shared/client/ReplayClientContext";

import styles from "./StackRenderer.module.css";
import Source from "./Source";

// This is a crappy approximation of the console; the UI isn't meant to be the focus of this branch.
// It would be nice to re-implement the whole Console UI though and re-write all of the legacy object inspector code.
function StackRenderer({ frames, stack }: { frames: Frame[]; stack: CallStack }) {
  if (frames == null || stack == null) {
    return null;
  }

  return (
    <Suspense fallback={<Loader />}>
      <div className={styles.StackGrid}>
        {stack.map((frameId, index) => (
          <StackFrameRenderer key={index} frameId={frameId} frames={frames} />
        ))}
      </div>
    </Suspense>
  );
}

function StackFrameRenderer({ frameId, frames }: { frameId: FrameId; frames: Frame[] }) {
  const client = useContext(ReplayClientContext);

  const frame = frames.find(frame => frame.frameId === frameId);
  if (frame == null) {
    return null;
  }

  const location = frame.location[0];
  const source = location !== null ? getSource(client, location.sourceId) : null;
  if (location == null || source == null) {
    return <div className={styles.Frame}>{frame.functionName}</div>;
  } else {
    return (
      <>
        <span>{frame.functionName || "(anonymous)"}</span>
        <span>@</span>
        <span className={styles.SourceColumn}>
          <Source className={styles.Source} location={location} />
        </span>
      </>
    );
  }
}

export default memo(StackRenderer);