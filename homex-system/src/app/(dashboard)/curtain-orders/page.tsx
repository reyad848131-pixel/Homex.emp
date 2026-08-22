import CurtainOrdersClient from "./curtain-client";

// Curtain-order tracker: every executed quotation that contains curtain items
// shows up here. Our price − supplier price = our profit on the curtains.
export default function CurtainOrdersPage() {
  return <CurtainOrdersClient />;
}
