// S5-11: Email channel using Resend SDK + @lexdiff/email templates.
import { Resend } from "resend";
import { renderChangeNotification } from "@lexdiff/email";

export interface EmailSendParams {
  to: string;
  subject: string;
  documentTitle: string;
  changeDescription: string;
}

export class EmailChannel {
  private readonly resend: Resend;
  private readonly from: string;

  constructor(apiKey: string, from = "noreply@lexdiff.pl") {
    this.resend = new Resend(apiKey);
    this.from = from;
  }

  async send(params: EmailSendParams): Promise<void> {
    const html = await renderChangeNotification({
      documentTitle: params.documentTitle,
      changeDescription: params.changeDescription,
    });
    await this.resend.emails.send({
      from: this.from,
      to: params.to,
      subject: params.subject,
      html,
    });
  }
}
