import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type WelcomeEmailProps = {
  name: string;
  email: string;
  password: string;
};

// Correo de bienvenida con las credenciales asignadas por el administrador.
// La contraseña se presenta como TEMPORAL con recomendación explícita de
// cambiarla en el primer inicio de sesión (sin forzado técnico: better-auth
// no obliga al cambio; si algún día se fuerza, actualizar este texto).
export function WelcomeEmail({ name, email, password }: WelcomeEmailProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>Tus credenciales de acceso a Mercado Elineas</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Bienvenido a Mercado Elineas</Heading>
          <Text style={text}>Hola {name},</Text>
          <Text style={text}>
            Un administrador ha creado tu cuenta en Mercado Elineas. Estas son
            tus credenciales de acceso:
          </Text>
          <Section style={credentials}>
            <Text style={credentialLine}>
              Correo: <strong>{email}</strong>
            </Text>
            <Text style={credentialLine}>
              Contraseña temporal: <strong>{password}</strong>
            </Text>
          </Section>
          <Text style={text}>
            Esta contraseña es temporal: te recomendamos cambiarla la primera
            vez que inicies sesión.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            Si no esperabas este correo, puedes ignorarlo.
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

const credentials = {
  backgroundColor: "#f4f4f5",
  borderRadius: "6px",
  margin: "16px 0",
  padding: "12px 16px",
};

const credentialLine = {
  color: "#18181b",
  fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "4px 0",
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
