import DeliveryBoardClient from "./board-client";

// Everyone may view the delivery board (read-only). Only the owner and the
// designated editor get the edit controls — decided by the API, which the
// client reflects via its `canEdit` flag.
export default function DeliveryBoardPage() {
  return <DeliveryBoardClient />;
}
