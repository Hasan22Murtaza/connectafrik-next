import Link from 'next/link'
import { Mail, Phone, MessageCircle, HelpCircle } from 'lucide-react'

const faqs = [
  {
    question: 'How do I create an account?',
    answer:
      'Click on "Join Community" in the header and fill out the registration form.',
  },
  {
    question: 'How do I reset my password?',
    answer:
      'Go to the sign in page and click "Forgot your password?" to receive a reset link via email.',
  },
  {
    question: 'How do I report inappropriate content?',
    answer:
      'Use the report button on any post or contact our support team directly.',
  },
]

const contactCards = [
  {
    title: 'Email Support',
    description: 'Reach our team for account and technical issues.',
    icon: Mail,
    content: (
      <a
        href="mailto:info@connectafrik.com"
        className="font-medium text-emerald-700 underline underline-offset-2 transition hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
      >
        info@connectafrik.com
      </a>
    ),
  },
  {
    title: 'Phone Support',
    description: 'Speak to us directly during support hours.',
    icon: Phone,
    content: (
      <div className="space-y-1.5">
        <a
          href="tel:+233534787731"
          className="block text-slate-700 transition hover:text-emerald-700 dark:text-slate-300 dark:hover:text-emerald-300"
        >
          +233 534 787 731
        </a>
        <a
          href="tel:+19144337155"
          className="block text-slate-700 transition hover:text-emerald-700 dark:text-slate-300 dark:hover:text-emerald-300"
        >
          +1 914 433 7155
        </a>
      </div>
    ),
  },
  {
    title: 'Live Chat',
    description: 'Send us a quick message for urgent help.',
    icon: MessageCircle,
    content: (
      <p className="text-slate-700 dark:text-slate-300">
        Live chat is available in-app from the help section.
      </p>
    ),
  },
]

const SupportPage = () => {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-8 dark:from-slate-950 dark:to-slate-950 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                <HelpCircle className="h-3.5 w-3.5" />
                Support Center
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-4xl">
                Need Help?
              </h1>
              <p className="max-w-2xl text-[15px] leading-7 text-slate-600 dark:text-slate-300">
                We are here to help with account, security, and platform-related
                questions.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <p className="font-medium text-slate-800 dark:text-slate-200">
                Typical response time
              </p>
              <p>Within 24 hours</p>
            </div>
          </div>
        </header>

        <section className="space-y-6">
          <div className="rounded-2xl border-l-4 border-emerald-500 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            For urgent account-security concerns, include your username and a
            short description so we can help faster.
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {contactCards.map(card => {
              const Icon = card.icon
              return (
                <article
                  key={card.title}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="mb-4 inline-flex rounded-lg bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                    {card.title}
                  </h2>
                  <p className="mt-2 mb-4 text-sm text-slate-600 dark:text-slate-400">
                    {card.description}
                  </p>
                  {card.content}
                </article>
              )
            })}
          </div>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-8">
            <h2 className="mb-5 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              {faqs.map(faq => (
                <div key={faq.question} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <h3 className="mb-1.5 font-semibold text-slate-900 dark:text-slate-100">
                    {faq.question}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300">{faq.answer}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-8">
            <h2 className="mb-4 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Additional Resources
            </h2>
            <div className="flex flex-wrap gap-4 text-sm">
              <Link
                href="/guidelines"
                className="rounded-md border border-slate-200 px-3 py-2 font-medium text-slate-700 transition hover:border-emerald-500 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-emerald-500 dark:hover:text-emerald-300"
              >
                Community Guidelines
              </Link>
              <Link
                href="/privacy-policy"
                className="rounded-md border border-slate-200 px-3 py-2 font-medium text-slate-700 transition hover:border-emerald-500 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-emerald-500 dark:hover:text-emerald-300"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms-of-service"
                className="rounded-md border border-slate-200 px-3 py-2 font-medium text-slate-700 transition hover:border-emerald-500 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-emerald-500 dark:hover:text-emerald-300"
              >
                Terms of Service
              </Link>
            </div>
          </article>
        </section>
      </div>
    </main>
  )
}

export default SupportPage
