import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";

interface ChangeNotificationProps {
  documentTitle?: string;
  changeDescription?: string;
}

export function ChangeNotification({
  documentTitle = "Legal Document",
  changeDescription = "A change has been detected.",
}: ChangeNotificationProps) {
  return (
    <Html>
      <Head />
      <Preview>Change detected in {documentTitle}</Preview>
      <Body>
        <Container>
          <Heading>Change Notification</Heading>
          <Text>{documentTitle}</Text>
          <Text>{changeDescription}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default ChangeNotification;
