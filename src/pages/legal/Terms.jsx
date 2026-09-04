import Header from '../../components/Header'
import LegalDoc from './LegalDoc'

const SECTIONS = [
  {
    title: '1. Objeto',
    body: [
      'Los presentes Términos y Condiciones (en adelante, los "Términos") regulan el acceso y uso de la aplicación Ls-PadelPro (en adelante, el "Servicio" o la "Plataforma"), destinada a que profesionales de la enseñanza del pádel (en adelante, el "Usuario") gestionen horarios, alumnos y cobros. La creación de una cuenta y/o el uso del Servicio implica la aceptación plena y sin reservas de estos Términos.',
    ],
  },
  {
    title: '2. Registro y responsabilidad de la cuenta',
    body: [
      'El acceso al Servicio requiere la creación de una cuenta personal e intransferible. El Usuario es responsable de la veracidad de los datos suministrados, de la confidencialidad de sus credenciales de acceso y de toda actividad realizada bajo su cuenta.',
    ],
  },
  {
    title: '3. Datos de terceros cargados por el Usuario',
    body: [
      'En el curso normal del uso del Servicio, el Usuario podrá cargar datos personales de terceros (en adelante, los "Alumnos"), incluyendo, sin limitarse a, nombre, número de contacto, categoría deportiva y disponibilidad horaria. El Usuario declara y garantiza contar con la autorización y/o el consentimiento correspondiente de dichos terceros (o de sus representantes legales, en caso de tratarse de menores de edad) para el tratamiento de sus datos personales dentro de la Plataforma, asumiendo la totalidad de la responsabilidad que de ello derive frente a los Alumnos y frente a cualquier autoridad de aplicación.',
    ],
  },
  {
    title: '4. Descripción del Servicio y disponibilidad',
    body: [
      'El Servicio se encuentra en etapa de desarrollo continuo y se provee "tal cual" (as is) y "según disponibilidad" (as available), sin garantías de ningún tipo, expresas o implícitas, incluyendo -sin limitarse a- garantías de comerciabilidad, aptitud para un fin determinado o ausencia de errores. Ls-PadelPro se reserva el derecho de modificar, suspender o discontinuar, total o parcialmente, cualquier funcionalidad del Servicio, con o sin previo aviso.',
    ],
  },
  {
    title: '5. Planes pagos, período de prueba y cobro automático',
    body: [
      'El Servicio ofrece un período de prueba gratuito por tiempo limitado, informado dentro de la aplicación, durante el cual el Usuario accede a la totalidad de las funcionalidades sin cargo. Finalizado dicho período, la continuidad del acceso requiere la contratación de un plan pago (mensual, trimestral o anual), cuyo valor vigente se informa dentro de la aplicación al momento de la contratación y puede ser modificado por Ls-PadelPro con notificación previa dentro de la Plataforma.',
      'Los planes pagos se renuevan automáticamente al vencimiento de cada período mediante débito recurrente, procesado por Mercado Pago como pasarela de pagos, hasta que el Usuario cancele la suscripción. El Usuario podrá cancelar la renovación en cualquier momento desde la Plataforma, conservando el acceso completo hasta el final del período ya abonado. Salvo disposición legal en contrario, los importes ya abonados no son reembolsables, incluso en caso de cancelación anticipada, sin perjuicio de lo siguiente: (i) cuando la normativa de protección al consumidor aplicable en la jurisdicción del Usuario reconozca un derecho de revocación o arrepentimiento sobre la contratación inicial de un plan pago, dicho derecho podrá ejercerse dentro del plazo que dicha normativa establezca (en Argentina, diez (10) días corridos desde la contratación); (ii) el Usuario podrá solicitar el reembolso del importe de una renovación automática ya debitada dentro de los tres (3) días corridos posteriores al cobro, conforme a esta política; y (iii) si el Usuario solicitó la cancelación de la renovación con anterioridad a la fecha del cobro y este, no obstante, se efectivizara, el importe correspondiente será reembolsado en su totalidad. Ninguna de las disposiciones precedentes limita los derechos que pudieran corresponder al Usuario conforme a la normativa de protección al consumidor aplicable.',
      'Si un cobro no pudiera efectuarse, el Usuario conservará el acceso a las funcionalidades del Servicio durante un plazo de gracia de tres (3) días corridos desde la fecha en que el cobro debía efectivizarse, a fin de regularizar su medio de pago. Vencido dicho plazo sin que el pago se regularice, Ls-PadelPro podrá suspender el acceso hasta que ello ocurra o se contrate un nuevo plan.',
    ],
  },
  {
    title: '6. Programa de embajadores',
    body: [
      'Ls-PadelPro podrá otorgar, a su exclusivo criterio, acceso gratuito y permanente a determinados Usuarios en el marco de un programa de embajadores. Dicho beneficio es intransferible, no genera derecho adquirido alguno y puede ser revocado por Ls-PadelPro en cualquier momento, en particular ante un uso indebido del Servicio.',
      'Adicionalmente, Ls-PadelPro podrá reconocer a los Usuarios que participen del programa de embajadores (en adelante, los "Embajadores") una comisión sobre los pagos efectivamente percibidos de los Usuarios que se hayan registrado utilizando su enlace de referido (en adelante, los "Referidos"), durante un período determinado a partir del primer pago de cada Referido. El porcentaje de la comisión, la duración de dicho período y las condiciones de acumulación entre distintos planes se informan dentro de la Plataforma y podrán ser modificados por Ls-PadelPro con notificación previa dentro de la aplicación, sin efecto retroactivo sobre comisiones ya devengadas.',
      'Ls-PadelPro podrá además reconocer a los Embajadores bonificaciones adicionales de monto fijo al alcanzar determinada cantidad de Referidos que hayan completado el período consecutivo de permanencia informado dentro de la Plataforma. Las condiciones, montos y umbrales de estas bonificaciones se informan dentro de la aplicación y podrán ser modificados por Ls-PadelPro con notificación previa, sin afectar bonificaciones ya devengadas y confirmadas.',
      'El pago de comisiones y bonificaciones se realiza mediante transferencia al alias de cobro que el Embajador cargue en su panel dentro de la Plataforma, siendo de su exclusiva responsabilidad la exactitud de dicho dato. Ls-PadelPro no será responsable por transferencias realizadas a un alias incorrectamente cargado por el Embajador.',
    ],
  },
  {
    title: '7. Limitación de responsabilidad',
    body: [
      'En la máxima medida permitida por la legislación aplicable, Ls-PadelPro no será responsable por daños directos, indirectos, incidentales, especiales o consecuentes derivados del uso o la imposibilidad de uso del Servicio, incluyendo -sin limitarse a- la pérdida de datos, pérdida de ingresos o interrupción de la actividad comercial del Usuario.',
    ],
  },
  {
    title: '8. Vigencia y terminación',
    body: [
      'Estos Términos rigen desde la creación de la cuenta y se mantienen vigentes mientras el Usuario utilice el Servicio. El Usuario podrá dar de baja su cuenta en cualquier momento. Ls-PadelPro podrá suspender o cancelar cuentas que incumplan estos Términos o la normativa vigente.',
    ],
  },
  {
    title: '9. Modificaciones',
    body: [
      'Ls-PadelPro podrá modificar estos Términos en cualquier momento. Los cambios sustanciales serán notificados dentro de la Plataforma. El uso continuado del Servicio con posterioridad a dicha notificación implica la aceptación de los Términos modificados.',
    ],
  },
  {
    title: '10. Ley aplicable',
    body: [
      'Estos Términos se rigen por las leyes de la República Argentina, sin perjuicio de las normas de protección al consumidor y de datos personales que resulten aplicables en la jurisdicción de residencia del Usuario.',
    ],
  },
  {
    title: '11. Contacto',
    body: ['contact-email'],
  },
]

export default function Terms() {
  return (
    <div className="max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto px-5 py-6 md:px-8 pb-16 fade-in">
      <Header backTo="/configuracion" backLabel="Configuración" />
      <LegalDoc title="Términos y condiciones" updated="Última actualización: septiembre 2026" sections={SECTIONS} />
    </div>
  )
}
