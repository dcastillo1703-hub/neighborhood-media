import { isIntegrationConfigured, integrationEnv } from "@/lib/integrations/config";
import { IntegrationAdapter } from "@/lib/integrations/types";

export const reservationSystemAdapter: IntegrationAdapter = {
  provider: "reservation-system",
  description: "Placeholder adapter for reservation/covers sync from Tock, OpenTable, or SevenRooms.",
  getConnectionGuide() {
    return {
      provider: "reservation-system",
      title: "Reservation and covers sync",
      summary: "Document the provider and mapping rules before bringing reservation data into reporting.",
      connectLabel: "Prepare reservations",
      steps: [
        "Set NEXT_PUBLIC_RESERVATION_PROVIDER.",
        "Confirm the provider account and export method.",
        "Validate booking-to-campaign attribution mapping."
      ]
    };
  },
  getConnectionStatus(connection) {
    return {
      provider: "reservation-system",
      status: connection && isIntegrationConfigured(integrationEnv.reservationProvider) ? "success" : "blocked",
      message:
        "Wire reservation provider SDK or API calls here to attribute bookings back to campaigns."
    };
  },
  async sync(_job, connection) {
    return this.getConnectionStatus(connection);
  }
};
