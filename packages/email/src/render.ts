import { render } from "@react-email/render";
import { createElement } from "react";
import { ChangeNotification } from "./templates/ChangeNotification.js";

export interface ChangeNotificationProps {
  documentTitle: string;
  changeDescription: string;
}

export async function renderChangeNotification(
  props: ChangeNotificationProps,
): Promise<string> {
  return render(createElement(ChangeNotification, props));
}
