import { Check } from 'lucide-react'
import { useState } from 'react'

function ServiceCard({ image, title, description, features, className, imageLoading = 'lazy' }) {
  const [isFlipped, setIsFlipped] = useState(false)

  return (
    <div 
      className={`h-screen/2 cursor-pointer perspective ${className || ''}`}
      onClick={() => setIsFlipped(!isFlipped)}
      style={{
        perspective: '1000px',
        height: '450px'
      }}
    >
      <div
        style={{
          transition: 'transform 0.6s',
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          width: '100%',
          height: '100%',
          position: 'relative',
        }}
      >
        {/* Front Side */}
        <div
          style={{
            backfaceVisibility: 'hidden',
            width: '100%',
            height: '100%',
          }}
          className="rounded-2xl overflow-hidden relative"
        >
          <img 
            src={image} 
            alt={title}
            loading={imageLoading}
            decoding="async"
            className="w-full h-full object-cover"
          />
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/40 flex flex-col justify-end p-6">
            <h3 className="text-2xl font-bold text-white mb-2">
              {title}
            </h3>
            <p className="text-gray-200 text-sm">
              {description}
            </p>
          </div>
        </div>

        {/* Back Side */}
        <div
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
          className="rounded-2xl overflow-y-auto bg-white border-2 border-gray-300 p-6 flex flex-col justify-center"
        >
          <div className="space-y-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-4">
                <Check
                  className="w-5 h-5 text-gray-800 mt-0.5 shrink-0"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
                <p className="text-gray-700 text-sm font-medium leading-relaxed">
                  {feature}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ServiceCard
