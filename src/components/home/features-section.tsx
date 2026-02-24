'use client';

import { motion } from 'framer-motion';
import { CreditCard, Shield, Clock, Headphones } from 'lucide-react';

const features = [
  {
    icon: CreditCard,
    title: 'Անվտանգ վճարում',
    description: 'Անվտանգ վճարումներ բանկային քարտերով և էլեկտրոնային դրամապանակներով',
  },
  {
    icon: Shield,
    title: '100% երաշխիք',
    description: 'Մենք երաշխավորում ենք ձեր գումարի անվտանգությունը',
  },
  {
    icon: Clock,
    title: 'Արագ ամրագրում',
    description: 'Տոմսեր ամրագրեք մի քանի րոպեում',
  },
  {
    icon: Headphones,
    title: '24/7 աջակցություն',
    description: 'Մեր թիմը միշտ պատրաստ է օգնել ձեզ',
  },
];

export default function FeaturesSection() {
  return (
    <section className="py-20 bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Ինչու GoCinema?
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Մենք առաջարկում ենք լավագույն կինոփորձը
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="text-center p-6 rounded-xl bg-white shadow-lg hover:shadow-xl transition-shadow"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full mb-4">
                <feature.icon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
