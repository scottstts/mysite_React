import { createContext, useContext } from 'react';

export interface LiftItem {
  src: string;
  ratio: number;
}

export interface LiftRequest {
  items: LiftItem[];
  index: number;
  // the print on the wall it lifts from and returns to
  from: HTMLElement;
  caption?: string;
}

interface LiftApi {
  lift: (_request: LiftRequest) => void;
  lifted: boolean;
}

export const LiftContext = createContext<LiftApi>({
  lift: () => {},
  lifted: false,
});

export const useLift = () => useContext(LiftContext);
