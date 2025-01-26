import { create } from "zustand";

interface ModalState {
    isInvestmentsModalOpen: boolean;
    setIsInvestmentsModalOpen: (status: boolean) => void;
    isTransferModalOpen: boolean;
    setIsTransferModalOpen: (status: boolean) => void;
}

export const useModalStore = create<ModalState>((set) => ({
    isInvestmentsModalOpen: false,
    setIsInvestmentsModalOpen: (status) => set({ isInvestmentsModalOpen: status }),
    isTransferModalOpen: false,
    setIsTransferModalOpen: (status) => set({ isTransferModalOpen: status }),
}));
