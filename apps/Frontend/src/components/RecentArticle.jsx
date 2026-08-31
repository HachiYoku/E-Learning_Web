const logo = '/Nav/favicon-arunthai.png'

function RecentArticle({ title, description, authorName, date, showReadMore = true, onReadMore }) {
  return (
    <div className="border-2 border-gray-300 p-4 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
      <h3 className="font-bold text-gray-900 mb-2 text-sm">
        {title}
      </h3>
      {description && (
        <p className="text-gray-600 text-xs mb-3">
          {description}
        </p>
      )}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <img 
              src={logo}
              alt="thaitalktips" 
              className="h-6 w-6 border-1 border-[#F5C6D8] rounded-md object-contain"
            />
            <span className="text-xs font-semibold text-gray-900">{authorName || 'thaitalktips'}</span>
          </div>
          <p className="text-gray-600 text-xs">{date}</p>
        </div>
        {showReadMore && (
          <button
            type="button"
            onClick={onReadMore}
            className="text-gray-600 text-xs underline hover:text-gray-900"
          >
            read more
          </button>
        )}
      </div>
    </div>
  )
}

export default RecentArticle
