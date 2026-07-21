import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type ChangeEmailVerificationProps = {
  url: string;
};

// Correo de confirmación de cambio de correo. Se envía a la NUEVA dirección: al
// pulsar el botón se confirma el token y recién ahí se aplica el cambio en el
// IS. Mientras no se confirme, la cuenta conserva el correo anterior.
export function ChangeEmailVerification({ url }: ChangeEmailVerificationProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>Confirma tu nuevo correo en Mercado Elineas</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Confirma tu nuevo correo</Heading>
          <Text style={text}>
            Recibimos una solicitud para cambiar el correo de tu cuenta de
            Mercado Elineas a esta dirección. Para completar el cambio, confirma
            que este correo es tuyo:
          </Text>
          <Section style={buttonSection}>
            <Button href={url} style={button}>
              Confirmar cambio de correo
            </Button>
          </Section>
          <Text style={text}>
            Si el botón no funciona, copia y pega este enlace en tu navegador:
          </Text>
          <Text style={link}>{url}</Text>
          <Hr style={hr} />
          <Text style={footer}>
            Este enlace caduca en 1 hora. Si no solicitaste este cambio, ignora
            este correo: tu cuenta seguirá con el correo actual.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: "#f4f4f5",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  margin: 0,
  padding: "24px 0",
};

const container = {
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  margin: "0 auto",
  maxWidth: "480px",
  padding: "32px",
};

const heading = {
  color: "#18181b",
  fontSize: "20px",
  margin: "0 0 16px",
};

const text = {
  color: "#3f3f46",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0 0 12px",
};

const buttonSection = {
  margin: "24px 0",
  textAlign: "center" as const,
};

const button = {
  backgroundColor: "#1b08ea",
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: 600,
  padding: "12px 24px",
  textDecoration: "none",
};

const link = {
  color: "#1b08ea",
  fontSize: "12px",
  lineHeight: "18px",
  margin: "0 0 12px",
  wordBreak: "break-all" as const,
};

const hr = {
  borderColor: "#e4e4e7",
  margin: "20px 0 12px",
};

const footer = {
  color: "#a1a1aa",
  fontSize: "12px",
  margin: 0,
};
