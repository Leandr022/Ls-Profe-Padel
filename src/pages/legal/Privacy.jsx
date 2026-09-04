import Header from '../../components/Header'
import LegalDoc from './LegalDoc'

const SECTIONS = [
  {
    title: '1. Responsable del tratamiento',
    body: [
      'Ls-PadelPro actúa como responsable del tratamiento de los datos personales detallados en la presente Política de Privacidad (en adelante, la "Política"), en su carácter de proveedor de la Plataforma.',
    ],
  },
  {
    title: '2. Datos objeto de tratamiento',
    body: [
      'Se recaban y almacenan las siguientes categorías de datos: (i) datos de identificación y contacto del Usuario, obtenidos a través del proveedor de autenticación (nombre y dirección de correo electrónico); (ii) datos de configuración de la cuenta (horarios, tarifas, plantillas de mensajes); (iii) datos personales de Alumnos cargados voluntariamente por el Usuario (nombre, número de contacto, categoría deportiva, disponibilidad horaria y notas asociadas); y (iv) datos vinculados al plan contratado y su estado de pago (plan elegido, fechas de vigencia e identificador de la suscripción asignado por Mercado Pago). Ls-PadelPro no accede ni almacena números de tarjeta u otros datos sensibles del medio de pago, que son gestionados directamente por Mercado Pago.',
    ],
  },
  {
    title: '3. Pagos y Mercado Pago',
    body: [
      'El procesamiento de los pagos de los planes de suscripción es realizado por Mercado Pago, actuando como procesador de pagos independiente. Al contratar un plan pago, el Usuario acepta además la política de privacidad y los términos y condiciones de Mercado Pago, disponibles en su sitio web, que rigen el tratamiento de los datos de su medio de pago.',
    ],
  },
  {
    title: '4. Finalidad del tratamiento',
    body: [
      'Los datos indicados se procesan con la finalidad de posibilitar el funcionamiento del Servicio: autenticación del Usuario, gestión de horarios y grupos de clase, y administración de cobros. Adicionalmente, y según se detalla en la Sección 10, se utilizan de forma limitada ciertas señales técnicas para medir la efectividad de las campañas publicitarias de Ls-PadelPro. Fuera de esa finalidad de medición, no se realiza tratamiento de datos con fines de perfilado ni de cesión a terceros ajenos a la prestación del Servicio.',
    ],
  },
  {
    title: '5. Base legal',
    body: [
      'El tratamiento de datos del Usuario se fundamenta en la ejecución del vínculo contractual implícito en la aceptación de los Términos y Condiciones. El tratamiento de datos de Alumnos se realiza bajo la responsabilidad y en virtud del consentimiento obtenido por el propio Usuario, conforme a lo establecido en la Sección 3 de dichos Términos.',
    ],
  },
  {
    title: '6. Infraestructura y ubicación de almacenamiento',
    body: [
      'Los datos se almacenan en la infraestructura de Supabase Inc., con centro de datos ubicado en San Pablo, Brasil. El acceso se encuentra restringido mediante políticas de seguridad a nivel de fila (Row Level Security), garantizando que cada Usuario únicamente pueda acceder a los datos de su propia cuenta.',
    ],
  },
  {
    title: '7. Plazo de conservación',
    body: [
      'Los datos se conservan mientras la cuenta permanezca activa. Ante una solicitud de baja de cuenta, los datos serán eliminados de los sistemas de producción dentro de un plazo razonable, sujeto a las limitaciones técnicas de los proveedores de infraestructura utilizados.',
    ],
  },
  {
    title: '8. Derechos del titular de los datos',
    body: [
      'El Usuario podrá ejercer sus derechos de acceso, rectificación, actualización y supresión respecto de sus datos y de los datos de sus Alumnos, dirigiéndose a contact-email. Toda solicitud será atendida en un plazo razonable.',
    ],
  },
  {
    title: '9. Datos almacenados localmente',
    body: [
      'Las preferencias de visualización (tema y tamaño de letra) se almacenan localmente en el dispositivo del Usuario y no se transmiten a los servidores de Ls-PadelPro. Las tecnologías de analítica y de medición publicitaria utilizadas se detallan en la Sección 10.',
    ],
  },
  {
    title: '10. Analítica de uso y medición publicitaria',
    body: [
      'Utilizamos Microsoft Clarity, un servicio de analítica provisto por Microsoft Corporation, para comprender cómo los Usuarios interactúan con la Plataforma (clics, desplazamiento y navegación entre pantallas) con el fin de mejorar la experiencia de uso. Este servicio se encuentra configurado para enmascarar el contenido de texto mostrado en pantalla, de modo que no se capturan datos personales de Usuarios ni de Alumnos (nombres, números de contacto, montos, notas). No se utiliza con fines publicitarios ni de perfilado comercial.',
      'Utilizamos además el Píxel de Meta y la API de Conversiones de Meta (Meta Pixel / Conversions API), herramientas provistas por Meta Platforms, Inc., para medir la efectividad de las campañas publicitarias de Ls-PadelPro. El Píxel de Meta se ejecuta en cada visita al sitio (únicamente en producción, profepadel.com, nunca en ambientes de prueba) y registra la visita mediante sus propias cookies. En los momentos de registro, activación de la cuenta, inicio de la contratación de un plan (checkout) o pago, el servidor de Ls-PadelPro también envía a Meta el correo electrónico y un identificador interno del Usuario, ambos procesados con la función hash SHA-256, junto con identificadores técnicos asociados al Píxel cuando están disponibles. No se envían datos de Alumnos ni datos operativos de la cuenta (horarios, tarifas, notas).',
    ],
  },
  {
    title: '11. Cesión a terceros',
    body: [
      'Ls-PadelPro no vende, alquila ni cede a terceros los datos personales de Usuarios ni de Alumnos, salvo (i) a Mercado Pago, en su carácter de procesador de pagos, en la medida necesaria para gestionar los planes de suscripción; (ii) a Meta Platforms, Inc. y a Microsoft Corporation, en la medida necesaria para la medición de campañas publicitarias y la analítica de uso descriptas en la Sección 10; o (iii) requerimiento de autoridad competente conforme a la legislación aplicable.',
    ],
  },
  {
    title: '12. Modificaciones a esta Política',
    body: [
      'Esta Política podrá ser actualizada periódicamente. Los cambios relevantes serán notificados dentro de la Plataforma.',
    ],
  },
  {
    title: '13. Contacto',
    body: ['contact-email'],
  },
]

export default function Privacy() {
  return (
    <div className="max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto px-5 py-6 md:px-8 pb-16 fade-in">
      <Header backTo="/configuracion" backLabel="Configuración" />
      <LegalDoc title="Política de privacidad" updated="Última actualización: agosto 2026" sections={SECTIONS} />
    </div>
  )
}
